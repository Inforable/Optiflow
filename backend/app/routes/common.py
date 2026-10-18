"""Small helpers shared by the route modules."""
from __future__ import annotations

from fastapi import HTTPException

from ..services.store import get_store


def load_case(sid: str, case_id: str) -> dict:
    case = get_store().get_case(sid, case_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found in sandbox {sid}")
    return case


def load_ticket(sid: str, ticket_id: str) -> dict:
    t = get_store().get_ticket(sid, ticket_id)
    if t is None:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
    return t


def names(sbx: dict) -> dict:
    from ..services.data import raci

    n = dict(raci()["names"])
    n.update(sbx.get("names") or {})
    return n


def short_name(full: str) -> str:
    return (full or "").split(",")[0].strip() or full
