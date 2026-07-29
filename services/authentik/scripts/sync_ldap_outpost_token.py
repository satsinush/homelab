# Run via: docker exec -i authentik-worker ak shell < sync_ldap_outpost_token.py
# Purpose: grant ldapservice full-directory search + print Outpost token for host secret.
from authentik.core.models import Application, User as AkUser
from authentik.flows.models import Flow
from authentik.outposts.models import Outpost, OutpostType
from authentik.providers.ldap.api import LDAPProviderSerializer
from authentik.providers.ldap.models import LDAPProvider
from authentik.rbac.models import Role
from guardian.shortcuts import assign_perm
from pathlib import Path

authn = Flow.objects.get(slug="default-authentication-flow")
inval = Flow.objects.get(slug="default-provider-invalidation-flow")
app, _ = Application.objects.get_or_create(slug="ldap", defaults={"name": "LDAP"})
app.name = "LDAP"
app.meta_hide = True
app.save()

p = LDAPProvider.objects.filter(name="LDAP").first()
if not p:
    s = LDAPProviderSerializer(
        data={
            "name": "LDAP",
            "authentication_flow": str(authn.pk),
            "authorization_flow": str(authn.pk),
            "invalidation_flow": str(inval.pk),
            "bind_mode": "cached",
            "search_mode": "cached",
            "base_dn": "dc=ldap,dc=goauthentik,dc=io",
            "uid_start_number": 2000,
            "gid_start_number": 4000,
            "mfa_support": False,
        }
    )
    assert s.is_valid(), s.errors
    p = s.save()
else:
    p.authentication_flow = authn
    p.authorization_flow = authn
    p.invalidation_flow = inval
    p.save()

app.backchannel_providers.set([p])
op, _ = Outpost.objects.get_or_create(
    name="LDAP Outpost", defaults={"type": OutpostType.LDAP}
)
op.type = OutpostType.LDAP
op.save()
op.providers.set([p])

# assign_perm only accepts Roles in Authentik 2024.8+ (not Users).
role, _ = Role.objects.get_or_create(name="ldap-search")
svc = AkUser.objects.filter(username="ldapservice").first()
if svc is not None and p is not None:
    role.users.add(svc)
    assign_perm("authentik_providers_ldap.search_full_directory", role, p)
    secret = Path("/run/secrets/ldap_service_password")
    if secret.is_file():
        svc.set_password(secret.read_text().strip())
        svc.save()
    print("ldap-search-perm-ok")

print("ldap-token:" + (getattr(getattr(op, "token", None), "key", "") or ""))
