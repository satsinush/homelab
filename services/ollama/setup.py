"""Ollama service — model bind mount (excluded from Restic by default)."""
from __future__ import annotations

from setup.service import Service, VolumeDir


class OllamaService(Service):
    name = "ollama"
    volume_dirs = [
        VolumeDir("./services/ollama/volumes/ollama", mode=0o700),
    ]


service = OllamaService()
