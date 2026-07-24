from django.apps import AppConfig


class HomelabSmbSyncConfig(AppConfig):
    name = "data.homelab_smb_sync"
    label = "homelab_smb_sync"
    verbose_name = "Homelab SMB password sync"

    def ready(self) -> None:
        from . import signals  # noqa: F401
