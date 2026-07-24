"""Ordered registry of Service instances used by root setup.py."""
from __future__ import annotations

from setup.service import Service


def get_services() -> list[Service]:
    from authentik.setup import service as authentik
    from alerts.setup import service as alerts
    from dashboard.setup import service as dashboard
    from ddclient.setup import service as ddclient
    from dockhand.setup import service as dockhand
    from gatus.setup import service as gatus
    from gotify.setup import service as gotify
    from headscale.setup import service as headscale
    from immich.setup import service as immich
    from nextcloud.setup import service as nextcloud
    from ollama.setup import service as ollama
    from pihole.setup import service as pihole
    from restic.setup import service as restic
    from rustdesk.setup import service as rustdesk
    from samba.setup import service as samba
    from stalwart.setup import service as stalwart
    from traefik.setup import service as traefik
    from unbound.setup import service as unbound
    from vaultwarden.setup import service as vaultwarden

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
