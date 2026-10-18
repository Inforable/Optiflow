"""Shared helpers for the Gemini agents: client, timeouts, tracing, citation validation."""
from __future__ import annotations

import concurrent.futures
import logging
import os
import threading
from typing import Any, Callable, Optional, Type

from pydantic import BaseModel

from ..config import get_settings
from ..services.data import normalize_citation, now_iso, valid_citation_ids
from ..services.store import get_store

log = logging.getLogger("lubeguard.agents")

_executor = concurrent.futures.ThreadPoolExecutor(max_workers=16, thread_name_prefix="live")
_client = None
_client_lock = threading.Lock()

CATEGORIES = ("man", "machine", "method", "material", "environment")


class LiveUnavailable(RuntimeError):
    """Raised when live AI cannot run (cached mode, no key, error or timeout)."""


def genai_client():
    """Construct (once) the google-genai client. Does not call the API."""
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                from google import genai

                s = get_settings()
                if not s.gemini_api_key:
                    raise LiveUnavailable("GEMINI_API_KEY is not set")
                os.environ.setdefault("GOOGLE_API_KEY", s.gemini_api_key)
                os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "False")
                _client = genai.Client(api_key=s.gemini_api_key)
    return _client


def build_client_unchecked(api_key: str = "construct-only"):
    """Construct a genai client without calling the API (used by import checks)."""
    from google import genai

    return genai.Client(api_key=api_key)


def call_with_timeout(fn: Callable[..., Any], *args, timeout: Optional[float] = None,
                      cancel: Optional[threading.Event] = None, **kwargs) -> Any:
    """Run fn in a worker thread; raise LiveUnavailable on timeout or error."""
    t = timeout if timeout is not None else get_settings().live_timeout_s
    fut = _executor.submit(fn, *args, **kwargs)
    try:
        return fut.result(timeout=t)
    except concurrent.futures.TimeoutError as exc:
        if cancel is not None:
            cancel.set()
        raise LiveUnavailable(f"live call exceeded {t:.0f} s") from exc
    except LiveUnavailable:
        raise
    except Exception as exc:
        if cancel is not None:
            cancel.set()
        raise LiveUnavailable(f"live call failed: {type(exc).__name__}: {exc}") from exc


def generate_structured(contents: Any, schema: Type[BaseModel], system: Optional[str] = None,
                        temperature: float = 0.2) -> BaseModel:
    """One google-genai call with structured output validated by a Pydantic model."""
    from google.genai import types

    s = get_settings()
    client = genai_client()
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=schema,
        temperature=temperature,
        system_instruction=system,
    )
    resp = client.models.generate_content(model=s.gemini_model, contents=contents, config=config)
    parsed = getattr(resp, "parsed", None)
    if isinstance(parsed, schema):
        return parsed
    if isinstance(parsed, dict):
        return schema.model_validate(parsed)
    text = resp.text or ""
    return schema.model_validate_json(text)


class TraceWriter:
    """Appends trace entries to the store as each step runs (clients see them live)."""

    def __init__(self, sid: str, case_id: str, cancel: Optional[threading.Event] = None) -> None:
        self.sid = sid
        self.case_id = case_id
        self.cancel = cancel or threading.Event()
        self.entries: list[dict] = []
        self._lock = threading.Lock()

    def write(self, step: str, summary: str, provenance: str = "ai") -> Optional[dict]:
        if self.cancel.is_set():
            return None
        entry = {"at": now_iso(), "step": step, "summary": summary[:300], "provenance": provenance}
        with self._lock:
            self.entries.append(entry)
        try:
            get_store().append_trace(self.sid, self.case_id, entry)
        except Exception as exc:  # trace is best effort
            log.warning("append_trace failed: %s", exc)
        return entry


def validate_cell(cell: dict, valid: set[str]) -> tuple[dict, bool]:
    """Normalise citations; downgrade to UNVERIFIED when any citation is not a known id."""
    out = dict(cell)
    cites = [normalize_citation(c) for c in (cell.get("citations") or []) if str(c).strip()]
    good = [c for c in cites if c in valid]
    bad = [c for c in cites if c not in valid]
    downgraded = False
    if out.get("verdict") in ("G", "NG") and (bad or not good):
        out["verdict"] = "UNVERIFIED"
        reason = f"citation not found: {', '.join(bad)}" if bad else "no valid citation"
        out["evidence"] = f"{out.get('evidence', '').rstrip('. ')} (downgraded: {reason})"
        downgraded = True
    out["citations"] = list(dict.fromkeys(good))
    out.setdefault("provenance", "ai")
    return out, downgraded


def validate_matrix(matrix: dict, evidence_ids: Optional[list[str]] = None) -> tuple[dict, list[str]]:
    valid = valid_citation_ids(evidence_ids)
    out: dict = {}
    downgraded: list[str] = []
    for cat in CATEGORIES:
        cell = matrix.get(cat) or {"verdict": "UNVERIFIED", "evidence": "No finding", "citations": []}
        out[cat], d = validate_cell(cell, valid)
        if d:
            downgraded.append(cat)
    return out, downgraded


def citation_validity(matrix: Optional[dict], actions: Optional[list[dict]] = None,
                      evidence_ids: Optional[list[str]] = None) -> tuple[int, int]:
    """(valid, total) citation counts for eval."""
    valid = valid_citation_ids(evidence_ids)
    total = ok = 0
    for cell in (matrix or {}).values():
        for c in cell.get("citations", []):
            total += 1
            ok += c in valid
    for a in actions or []:
        for c in a.get("sopCitations", []):
            total += 1
            ok += c in valid
    return ok, total
