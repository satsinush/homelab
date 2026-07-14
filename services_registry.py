"""Ordered registry of Service instances used by root setup.py."""
from __future__ import annotations

import importlib.util
from pathlib import Path

from service import Service


def _load_hyphen_module(path: str, module_name: str):
    """Load a setup.py under a directory whose name is not a valid Python package."""
    full = Path(path).resolve()
    spec = importlib.util.spec_from_file_location(module_name, full)
    if spec is None or spec.loader is None:
        raise ImportError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def get_services() -> list[Service]:
    from authentik.setup import service as authentik
    from apprise.setup import service as apprise
    from collabora.setup import service as collabora
    from ddclient.setup import service as ddclient
    from dockhand.setup import service as dockhand
    from gatus.setup import service as gatus
    from gotify.setup import service as gotify
    from nextcloud.setup import service as nextcloud
    from ollama.setup import service as ollama
    from pihole.setup import service as pihole
    from restic.setup import service as restic
    from rustdesk.setup import service as rustdesk
    from traefik.setup import service as traefik
    from unbound.setup import service as unbound
    from vaultwarden.setup import service as vaultwarden

    dashboard = _load_hyphen_module(
        "homelab-dashboard/setup.py", "homelab_dashboard_setup"
    ).service

    # Order: infra / backup creds → auth → monitoring → apps
    return [
        traefik,
        restic,
        unbound,
        pihole,
        authentik,
        gatus,
        dashboard,
        dockhand,
        gotify,
        apprise,
        vaultwarden,
        collabora,
        nextcloud,
        rustdesk,
        ddclient,
        ollama,
    ]
