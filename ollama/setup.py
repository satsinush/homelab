"""Ollama service — model bind mount (excluded from Restic by default)."""
from __future__ import annotations

from service import Service, VolumeDir


class OllamaService(Service):
    name = "ollama"
    volume_dirs = [
        VolumeDir("./ollama/volumes/ollama", uid=0, gid=0, mode=0o755),
    ]


service = OllamaService()
