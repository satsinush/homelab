"""Ordered registry of Service instances used by root setup.py."""
from __future__ import annotations

from setup.service import Service


def get_services() -> list[Service]:
    from services.authentik.setup import service as authentik
    from services.alerts.setup import service as alerts
    from services.dashboard.setup import service as dashboard
    from services.ddclient.setup import service as ddclient
    from services.dockhand.setup import service as dockhand
    from services.gatus.setup import service as gatus
    from services.gotify.setup import service as gotify
    from services.headscale.setup import service as headscale
    from services.immich.setup import service as immich
    from services.nextcloud.setup import service as nextcloud
    from services.ollama.setup import service as ollama
    from services.pihole.setup import service as pihole
    from services.restic.setup import service as restic
    from services.rustdesk.setup import service as rustdesk
    from services.samba.setup import service as samba
    from services.stalwart.setup import service as stalwart
    from services.traefik.setup import service as traefik
    from services.unbound.setup import service as unbound
    from services.vaultwarden.setup import service as vaultwarden

    # Order: infra → auth/ldap → mail → files/photos → vpn → monitoring → apps
    return [
        traefik,
        restic,
        unbound,
        pihole,
        authentik,
        stalwart,
        samba,
        nextcloud,
        immich,
        headscale,
        gatus,
        dashboard,
        dockhand,
        gotify,
        alerts,
        vaultwarden,
        rustdesk,
        ddclient,
        ollama,
    ]
