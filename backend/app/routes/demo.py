"""Demo sandbox routes: session, join, reset."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..models import JoinRequest, SandboxRequest, SessionRequest, SessionResponse
from ..services.auth import current_uid, require_member
from ..services.seed import CASE_ID, seed_case
from ..services.store import get_store

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/session", response_model=SessionResponse)
def create_session(body: SessionRequest, uid: str = Depends(current_uid)) -> SessionResponse:
    store = get_store()
    sid, code = store.create_sandbox(uid, "manager", CASE_ID)
    seed_case(sid)
    return SessionResponse(sandboxId=sid, code=code, caseId=CASE_ID, role="manager")


@router.post("/join", response_model=SessionResponse)
def join(body: JoinRequest, uid: str = Depends(current_uid)) -> SessionResponse:
    store = get_store()
    sid = store.find_sandbox_by_code(body.code)
    if not sid:
        raise HTTPException(status_code=404, detail="Unknown join code")
    sbx = store.get_sandbox(sid) or {}
    if (sbx.get("members") or {}).get(uid) != "manager":
        store.add_member(sid, uid, "engineer")
    return SessionResponse(sandboxId=sid, code=sbx.get("code", body.code.upper()),
                           caseId=sbx.get("caseId", CASE_ID), role="engineer")


@router.post("/reset")
def reset(body: SandboxRequest, uid: str = Depends(current_uid)) -> dict:
    require_member(body.sandboxId, uid)
    store = get_store()
    store.reset_sandbox(body.sandboxId)
    seed_case(body.sandboxId)
    return {"ok": True}
