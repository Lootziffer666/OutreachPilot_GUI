"""CSV exporter — writes outreach results to a CSV file."""

import csv
import datetime
import logging
from pathlib import Path

from outreachpilot.config import DATA_DIR

logger = logging.getLogger(__name__)


class CSVExporter:
    def export(self, rows: list[dict], config: dict | None = None) -> Path:
        """Export rows to a CSV file in the data directory."""
        config = config or {}
        filename = config.get("filename", f"outreach_{datetime.date.today().isoformat()}.csv")
        filepath = DATA_DIR / filename

        if not rows:
            logger.warning("No rows to export")
            return filepath

        filepath.parent.mkdir(parents=True, exist_ok=True)

        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

        logger.info("Exported %d rows to %s", len(rows), filepath)
        return filepath
