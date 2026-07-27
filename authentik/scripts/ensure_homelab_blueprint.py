# Run via: docker exec -i authentik-worker ak shell < ensure_homelab_blueprint.py
# Prints one of: blueprint-ok | blueprint-missing | blueprint-error:<status>
from authentik.blueprints.models import BlueprintInstance, BlueprintInstanceStatus
from authentik.core.models import Application
from authentik.providers.ldap.models import LDAPProvider

NAME = "Homelab Bootstrap"
b = BlueprintInstance.objects.filter(name=NAME).first()
if b is None:
    print("blueprint-missing")
elif b.status == BlueprintInstanceStatus.SUCCESSFUL:
    print("blueprint-ok")
else:
    # CLI apply can succeed without flipping instance status; trust objects.
    has_ldap = LDAPProvider.objects.filter(name="LDAP").exists()
    has_apps = Application.objects.filter(
        slug__in=["ldap", "nextcloud", "immich", "homelab-dashboard"]
    ).count() >= 4
    if has_ldap and has_apps:
        b.status = BlueprintInstanceStatus.SUCCESSFUL
        b.save(update_fields=["status"])
        print("blueprint-ok")
    else:
        print(f"blueprint-error:{b.status}")
