"""Ask LubeGuard route (GraphRAG-lite)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..agents import ask as ask_agent
from ..models import AskRequest, AskResponse
from ..services.auth import current_uid, require_member
from ..services.store import get_store

router = APIRouter(tags=["ask"])


@router.post("/ask")
def ask(body: AskRequest, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    case = get_store().get_case(body.sandboxId, body.caseId) if body.caseId else None
    resp, _cached = ask_agent.ask(body.question, case, sbx.get("kgExtra"))
    return AskResponse.model_validate(resp).model_dump(mode="json")
