"""Uniform terminal formatting for setup scripts."""
from __future__ import annotations

import sys


def section(title: str, emoji: str = "") -> None:
    """Blank line + phase header (optionally with an existing service emoji)."""
    prefix = f"{emoji} " if emoji else ""
    print(f"\n{prefix}{title}")


def ok(msg: str) -> None:
    print(f"   ✅ {msg}")


def warn(msg: str) -> None:
    print(f"   ⚠️  {msg}")


def error(msg: str) -> None:
    print(f"❌ {msg}")


def info(msg: str) -> None:
    print(f"   ℹ️  {msg}")


def skip(msg: str) -> None:
    print(f"   ⏭️  {msg}")


def step(msg: str) -> None:
    """Indented progress line without an icon."""
    print(f"   {msg}")


def die(msg: str, code: int = 1) -> None:
    error(msg)
    sys.exit(code)


def banner(*lines: str) -> None:
    """Print a multi-line CLI banner as-is."""
    for line in lines:
        print(line)
