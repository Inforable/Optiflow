"""Notification routes (fallback for clients without Firestore listeners)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from ..models import Notification, SandboxRequest
from ..services.auth import current_uid, require_member
from ..services.store import get_store

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications(sandboxId: str, role: Optional[str] = None, uid: str = Depends(current_uid)) -> list[dict]:
    require_member(sandboxId, uid)
    items = get_store().list_notifications(sandboxId, role if role in ("manager", "engineer") else None)
    return [Notification.model_validate(n).model_dump(mode="json") for n in items]


@router.post("/{nid}/read")
def mark_read(nid: str, body: SandboxRequest, uid: str = Depends(current_uid)) -> dict:
    require_member(body.sandboxId, uid)
    if not get_store().mark_read(body.sandboxId, nid):
        raise HTTPException(status_code=404, detail=f"Notification {nid} not found")
    return {"ok": True}
