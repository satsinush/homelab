"""Homelab custom Authentik settings (mounted at /data/user_settings.py).

Loaded by authentik/root/settings.py via ``data.user_settings``.
Adds a tiny app that syncs cleartext passwords to Samba via host-api
whenever Authentik calls User.set_password (Admin UI, flows, blueprints).
"""

TENANT_APPS = [
    "data.homelab_smb_sync.apps.HomelabSmbSyncConfig",
]
