"""Deduplication filter — removes already-processed signals."""

import logging

logger = logging.getLogger(__name__)


def deduplicate(signals: list, seen_ids: set[str]) -> list:
    """Remove signals whose platform_id is already in seen_ids."""
    fresh = [s for s in signals if s.platform_id not in seen_ids]
    logger.info("Dedup: %d → %d signals", len(signals), len(fresh))
    return fresh
