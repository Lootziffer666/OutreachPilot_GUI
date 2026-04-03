"""Persona loader — loads personality config."""

from outreachpilot.config import load_personality


def get_persona() -> dict:
    """Load the active persona from config."""
    return load_personality()
