"""Caller identity and sandbox membership.

AUTH_MODE=firebase verifies `Authorization: Bearer <Firebase ID token>` with firebase_admin.
AUTH_MODE=off (local development) reads `X-Dev-Uid` (default `dev-user`).
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import Header, HTTPException

from ..config import get_settings
from .store import get_store

log = logging.getLogger("lubeguard.auth")


def _verify_firebase(token: str) -> str:
    import firebase_admin
    from firebase_admin import auth as fb_auth

    if not firebase_admin._apps:
        s = get_settings()
        firebase_admin.initialize_app(options={"projectId": s.google_cloud_project} if s.google_cloud_project else None)
    decoded = fb_auth.verify_id_token(token)
    return decoded["uid"]


def current_uid(authorization: Optional[str] = Header(default=None),
                x_dev_uid: Optional[str] = Header(default=None)) -> str:
    """FastAPI dependency returning the caller uid."""
    s = get_settings()
    if s.auth_mode == "off":
        return (x_dev_uid or "dev-user").strip() or "dev-user"
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization: Bearer <Firebase ID token>")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return _verify_firebase(token)
    except Exception as exc:  # invalid, expired or revoked token
        log.info("token verification failed: %s", exc)
        raise HTTPException(status_code=401, detail="Invalid Firebase ID token") from exc


def require_member(sid: str, uid: str) -> dict:
    """Return the sandbox doc if the caller is a member (manager or engineer)."""
    store = get_store()
    sbx = store.get_sandbox(sid)
    if not sbx:
        raise HTTPException(status_code=404, detail=f"Sandbox {sid} not found")
    members = sbx.get("members") or {}
    if uid in members:
        return sbx
    if get_settings().auth_mode == "off":
        # Local development: be demo-friendly and enrol unknown dev uids as engineers
        store.add_member(sid, uid, "engineer")
        sbx.setdefault("members", {})[uid] = "engineer"
        return sbx
    raise HTTPException(status_code=403, detail="Not a member of this sandbox")


def member_role(sbx: dict, uid: str) -> str:
    return (sbx.get("members") or {}).get(uid, "engineer")
