"""FastAPI application factory for OutreachPilot.

Exposes a REST API consumed by the React GUI (OutreachPilot_GUI).
CORS is enabled so the Vite dev-server (port 3000) can call this backend.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

STATIC_DIR = Path(__file__).parent / "static"


def create_app() -> FastAPI:
    app = FastAPI(
        title="OutreachPilot Backend",
        description="REST API for the OutreachPilot GUI — Reddit scan + AI analysis.",
        version="0.1.0",
    )

    # Allow the Vite dev server and any deployed frontend to call this API
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routes
    from outreachpilot.routes.scan import router as scan_router
    app.include_router(scan_router)

    # Serve static files (e.g. the built React app) if present
    if STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/")
    async def index():
        return {
            "message": "OutreachPilot Backend v0.1.0",
            "docs": "/docs",
            "health": "/api/health",
        }

    return app
