<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# OutreachPilot GUI

A modern dashboard for managing Reddit outreach campaigns — powered by real Reddit scanning (via the embedded Python backend) and AI-generated messages.

View the app in AI Studio: https://ai.studio/apps/724d0453-d9c2-4427-a940-1024266bbb23

---

## Architecture

```
Frontend  (React / Vite)      →  http://localhost:3000
Backend   (FastAPI / Python)  →  http://localhost:8000
Reddit API (public JSON)      →  no auth needed
OpenAI API                    →  requires OPENAI_API_KEY
```

The GUI automatically detects whether the Python backend is running.
- **Backend online** → real Reddit posts are scanned, analysed with OpenAI (GPT-4o-mini by default)
- **Backend offline** → falls back to Gemini mock mode (demo data, Gemini analysis)

---

## Quick Start

### 1 — Frontend (React GUI)

**Prerequisites:** Node.js ≥ 18

```bash
npm install
cp .env.example .env.local   # add your GEMINI_API_KEY
npm run dev                   # http://localhost:3000
```

### 2 — Python Backend (real Reddit scanning)

**Prerequisites:** Python ≥ 3.11

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env           # add your OPENAI_API_KEY
python -m outreachpilot serve  # http://localhost:8000
```

Open the GUI at http://localhost:3000 — the header will show **"Backend Live"** when the Python server is reachable.

---

## Configuration

All configuration lives in `backend/config/`:

| File | Purpose |
|------|---------|
| `subreddits.yml` | Subreddits to monitor (one per line) |
| `filters.yml`    | Score thresholds, keyword filters, AI preferences |
| `personality.yml` | Voice/tone used in AI-generated replies |

You can also configure everything directly in the GUI (Configuration, Personality, and Preferences tabs).

---

## Backend Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | OpenAI key for GPT-based post analysis |
| `LLM_MODEL` | optional | Model to use (default: `gpt-4o-mini`) |
| `SPREADSHEET_ID` | optional | Google Sheet ID for CSV/Sheets export |
| `GOOGLE_CLIENT_ID` | optional | OAuth client for Sheets export |
| `GOOGLE_CLIENT_SECRET` | optional | OAuth client secret for Sheets export |

---

## CLI Mode (no GUI)

You can also run the backend as a standalone CLI scanner:

```bash
cd backend
python -m outreachpilot scan --reddit          # Scan + save locally
python -m outreachpilot scan --reddit --csv    # Also export to CSV
python -m outreachpilot scan --no-sheets       # Skip Google Sheets
```

---

## Deployment

The frontend is deployed via Google AI Studio (Cloud Run).  
The backend can be deployed to any Python-capable host (Railway, Fly.io, a VPS, etc.).

Set `VITE_BACKEND_URL` in your frontend environment to point the GUI at your deployed backend URL.

