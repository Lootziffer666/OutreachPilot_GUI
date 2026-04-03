"""Storage modules for persisting scan data locally."""

from outreachpilot.storage.signals import save_signals, load_signals, load_recent_signal_ids
from outreachpilot.storage.progress import load_progress, save_progress
from outreachpilot.storage.scan_history import record_scan, load_scan_history

__all__ = [
    "save_signals", "load_signals", "load_recent_signal_ids",
    "load_progress", "save_progress",
    "record_scan", "load_scan_history",
]
