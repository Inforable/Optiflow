"""FastAPI app: JSON API under /api plus the built frontend (SPA) and /fixtures."""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .config import VERSION, get_settings
from .routes import ask, cases, demo, evidence, kg, notifications, tickets
from .services.data import BACKEND_DIR, fixtures_dir

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))

app = FastAPI(title="Optiflow LubeGuard API", version=VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/health")
def health() -> dict:
    s = get_settings()
    return {"ok": True, "version": VERSION, "aiMode": s.ai_mode, "store": s.store}


for r in (demo.router, cases.router, evidence.router, tickets.router, kg.router, ask.router, notifications.router):
    api.include_router(r)
app.include_router(api)


def static_dir() -> str | None:
    for cand in (os.environ.get("STATIC_DIR", ""), os.path.join(BACKEND_DIR, "static"), "/app/static"):
        if cand and os.path.isdir(cand):
            return cand
    return None


def _safe_join(base: str, rel: str) -> str | None:
    path = os.path.normpath(os.path.join(base, rel))
    if not path.startswith(os.path.normpath(base)):
        return None
    return path if os.path.isfile(path) else None


@app.get("/fixtures/{name:path}", include_in_schema=False)
def fixtures(name: str):
    path = _safe_join(fixtures_dir(), name)
    if not path:
        raise HTTPException(status_code=404, detail="fixture not found")
    return FileResponse(path)


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    if full_path == "api" or full_path.startswith("api/"):
        return JSONResponse({"detail": "Not Found"}, status_code=404)
    base = static_dir()
    if not base:
        return JSONResponse({"detail": "Frontend not built. API is under /api.", "health": "/api/health"},
                            status_code=404)
    if full_path:
        path = _safe_join(base, full_path)
        if path:
            return FileResponse(path)
    index = os.path.join(base, "index.html")
    if os.path.isfile(index):
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="index.html not found")
