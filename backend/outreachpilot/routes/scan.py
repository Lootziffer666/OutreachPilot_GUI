"""Scan API routes — provides REST endpoints for the OutreachPilot GUI.

The GUI calls these endpoints to:
- Start a Reddit scan (POST /api/scan)
- Poll scan progress (GET /api/scan/{scan_id})
- Retrieve all stored results (GET /api/results)
- Read / update YAML-based config (GET|POST /api/config/*)
"""

from __future__ import annotations

import datetime
import logging
import threading
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from outreachpilot.config import (
    load_subreddits, load_personality, load_filters,
    get_max_post_age_hours, CONFIG_DIR,
    ensure_data_dirs,
)
from outreachpilot.storage.signals import save_signals, load_signals, list_signal_dates

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")

# ── In-memory scan job store ──────────────────────────────────────────────────
_scans: dict[str, dict] = {}


# ── Pydantic models ───────────────────────────────────────────────────────────

class SubredditItem(BaseModel):
    name: str
    active: bool = True


class PersonalityPayload(BaseModel):
    name: str = ""
    description: str = ""
    tone: str = ""
    context: str = ""


class FiltersPayload(BaseModel):
    minKarma: int = 2
    maxAgeHours: int = 24
    keywords: list[str] = []
    excludeKeywords: list[str] = []


class ScanRequest(BaseModel):
    subreddits: list[SubredditItem] = []
    personality: PersonalityPayload = PersonalityPayload()
    filters: FiltersPayload = FiltersPayload()


# ── Helper: map backend signal dict → GUI OutreachResult ─────────────────────

def _engage_to_relevance(engage: str) -> int:
    return {"Yes": 90, "Maybe": 50, "No": 15}.get(engage, 50)


def _signal_to_result(sig: dict) -> dict:
    analysis = sig.get("analysis", {})
    engage = analysis.get("engage", "Maybe")
    return {
        "id": sig.get("id", ""),
        "subreddit": sig.get("subreddit", ""),
        "title": sig.get("title", ""),
        "author": sig.get("author", ""),
        "content": sig.get("body", ""),
        "url": sig.get("url", ""),
        "relevance": _engage_to_relevance(engage),
        "reasoning": analysis.get("why", analysis.get("summary", "")),
        "generatedMessage": analysis.get("suggested_comment", analysis.get("suggested_reply", "")),
        "status": "pending",
        "timestamp": datetime.datetime.fromtimestamp(
            sig.get("created_utc", time.time()), tz=datetime.timezone.utc
        ).strftime("%H:%M") if sig.get("created_utc") else datetime.datetime.now().strftime("%H:%M"),
        # Extra fields surfaced for the expanded AI panel
        "summary": analysis.get("summary", ""),
        "coolestComment": analysis.get("coolest_comment", ""),
        "suggestedReply": analysis.get("suggested_reply", ""),
        "engage": engage,
        "score": sig.get("score", 0),
        "replyCount": sig.get("reply_count", 0),
    }


# ── Background scan worker ────────────────────────────────────────────────────

def _run_scan(scan_id: str, subreddits: list[str], personality: dict, filters: dict) -> None:
    """Background thread: scan subreddits, analyse signals, store results."""
    job = _scans[scan_id]
    job["status"] = "running"
    job["results"] = []
    job["error"] = None

    try:
        from outreachpilot.scanners.reddit import RedditScanner
        from outreachpilot.filters.rule_filter import apply_pre_filters
        from outreachpilot.analyzers.pipeline import analyze_signal

        ensure_data_dirs()
        max_age = get_max_post_age_hours(filters)
        scanner = RedditScanner()
        total = len(subreddits)
        all_signal_dicts: list[dict] = []

        for idx, subreddit in enumerate(subreddits, 1):
            job["progress"] = int((idx - 1) / total * 100)
            job["current_sub"] = subreddit
            logger.info("[scan %s] [%d/%d] r/%s", scan_id[:8], idx, total, subreddit)

            signals = scanner.scan([subreddit], max_age_hours=max_age)
            signals = apply_pre_filters(signals, filters)

            for signal in signals:
                try:
                    analysis = analyze_signal(signal, personality=personality, filters=filters)
                except Exception as exc:
                    logger.warning("Analysis error for %s: %s", signal.platform_id, exc)
                    from outreachpilot.analyzers.base import Analysis
                    analysis = Analysis.error_fallback()

                age_hrs = round((time.time() - signal.created_utc) / 3600, 1) if signal.created_utc else 0
                created_str = (
                    datetime.datetime.fromtimestamp(signal.created_utc, tz=datetime.timezone.utc)
                    .strftime("%Y-%m-%d %H:%M")
                    if signal.created_utc else ""
                )

                sig_dict = {
                    "id": f"reddit_{signal.platform_id}",
                    "platform": "reddit",
                    "platform_id": signal.platform_id,
                    "url": signal.url,
                    "title": signal.title,
                    "body": signal.body[:500],
                    "author": signal.author,
                    "subreddit": subreddit,
                    "score": signal.score,
                    "reply_count": signal.reply_count,
                    "created_utc": signal.created_utc,
                    "age_hrs": age_hrs,
                    "created_str": created_str,
                    "status": signal.status,
                    "analysis": {
                        "summary": analysis.summary,
                        "engage": analysis.engage,
                        "why": analysis.why,
                        "coolest_comment": analysis.coolest_comment,
                        "suggested_reply": analysis.suggested_reply,
                        "suggested_comment": analysis.suggested_post_comment,
                    },
                }
                all_signal_dicts.append(sig_dict)
                job["results"].append(_signal_to_result(sig_dict))

        # Persist to daily storage
        if all_signal_dicts:
            save_signals(all_signal_dicts)

        job["status"] = "done"
        job["progress"] = 100
        job["current_sub"] = None
        logger.info("[scan %s] finished, %d results", scan_id[:8], len(job["results"]))

    except Exception as exc:
        logger.exception("[scan %s] error: %s", scan_id[:8], exc)
        job["status"] = "error"
        job["error"] = str(exc)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@router.post("/scan")
async def start_scan(req: ScanRequest):
    """Start a Reddit scan in a background thread, return a scan_id to poll."""
    active_subs = [s.name for s in req.subreddits if s.active]
    if not active_subs:
        # Fall back to config file
        try:
            active_subs = load_subreddits()
        except ValueError:
            raise HTTPException(status_code=400, detail="No active subreddits configured.")

    # Build personality dict from GUI payload or config file
    pers = req.personality
    if pers.name:
        personality = {
            "name": pers.name,
            "bio": pers.description,
            "tone": {"style": pers.tone},
        }
    else:
        personality = load_personality()

    # Build filters dict from GUI payload
    gui_f = req.filters
    filters = {
        "thresholds": {
            "min_score": gui_f.minKarma,
            "max_age_hours": gui_f.maxAgeHours,
            "min_comments": 0,
            "max_comments": 500,
        },
        "keywords": {
            "include": gui_f.keywords,
            "exclude": gui_f.excludeKeywords,
        },
        "allowed_statuses": ["active"],
    }
    # Merge AI preferences from config file if available
    file_filters = load_filters()
    if "ai_preferences" in file_filters:
        filters["ai_preferences"] = file_filters["ai_preferences"]

    scan_id = str(uuid.uuid4())
    _scans[scan_id] = {
        "id": scan_id,
        "status": "queued",
        "progress": 0,
        "current_sub": None,
        "results": [],
        "error": None,
        "created_at": datetime.datetime.now().isoformat(),
        "subreddits": active_subs,
    }

    t = threading.Thread(
        target=_run_scan,
        args=(scan_id, active_subs, personality, filters),
        daemon=True,
    )
    t.start()

    return {"scan_id": scan_id, "subreddits": active_subs}


@router.get("/scan/{scan_id}")
async def get_scan(scan_id: str):
    """Poll a running scan for status, progress, and accumulated results."""
    job = _scans.get(scan_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return {
        "scan_id": scan_id,
        "status": job["status"],
        "progress": job["progress"],
        "current_sub": job.get("current_sub"),
        "results": job["results"],
        "error": job.get("error"),
    }


@router.get("/results")
async def get_results(date: str | None = None):
    """Return stored results from local signal files."""
    dates = list_signal_dates()
    if not dates:
        return {"results": [], "dates": []}

    target_date = date or dates[0]
    raw = load_signals(target_date)
    results = [_signal_to_result(s) for s in raw]
    return {"results": results, "dates": dates, "date": target_date}


@router.get("/config")
async def get_config():
    """Return current YAML-based configuration."""
    try:
        subreddits = load_subreddits()
    except ValueError:
        subreddits = []
    personality = load_personality()
    filters = load_filters()
    return {
        "subreddits": subreddits,
        "personality": personality,
        "filters": filters,
    }
