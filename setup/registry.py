"""Ordered registry of Service instances used by root setup.py."""
from __future__ import annotations

from setup.service import Service


def get_services() -> list[Service]:
    from authentik.setup import service as authentik
    from apprise.setup import service as apprise
    from dashboard.setup import service as dashboard
    from ddclient.setup import service as ddclient
    from dockhand.setup import service as dockhand
    from gatus.setup import service as gatus
    from gotify.setup import service as gotify
    from headscale.setup import service as headscale
    from ollama.setup import service as ollama
    from pihole.setup import service as pihole
    from restic.setup import service as restic
    from rustdesk.setup import service as rustdesk
    from samba.setup import service as samba
    from sftpgo.setup import service as sftpgo
    from traefik.setup import service as traefik
    from unbound.setup import service as unbound
    from vaultwarden.setup import service as vaultwarden

    # Order: infra / backup creds → auth → vpn → monitoring → apps
    return [
        traefik,
        restic,
        unbound,
        pihole,
        authentik,
        headscale,
        gatus,
        dashboard,
        dockhand,
        gotify,
        apprise,
        vaultwarden,
        samba,
        sftpgo,
        rustdesk,
        ddclient,
        ollama,
    ]
