"""Ticket routes: list, manual create, patch, progress, complete."""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..models import ChecklistStep, CompleteRequest, EvidenceRequest, Progress, ProgressUpdate, Ticket
from ..services import data
from ..services.auth import current_uid, member_role, require_member
from ..services.notify import notify
from ..services.store import get_store
from .common import load_ticket, names, short_name

router = APIRouter(prefix="/tickets", tags=["tickets"])

AssigneeRole = Literal["engineer", "mechanical_shift_b", "manager"]


class TicketCreate(BaseModel):
    sandboxId: str
    type: Literal["evidence_request", "corrective", "safety_test"] = "corrective"
    title: str
    caseId: str = "C-0412"
    component: str = "LO-01"
    priority: Literal["high", "medium", "low"] = "medium"
    dueAt: Optional[str] = None
    estimateMin: int = 30
    assigneeRole: AssigneeRole = "engineer"
    assigneeName: Optional[str] = None
    status: Literal["open", "in_progress", "on_hold", "done", "verified"] = "open"
    checklist: list[ChecklistStep] = Field(default_factory=list)
    evidenceRequest: Optional[EvidenceRequest] = None
    report: Optional[dict] = None
    actionId: Optional[str] = None


class TicketPatch(BaseModel):
    sandboxId: str
    status: Optional[Literal["open", "in_progress", "on_hold", "done", "verified"]] = None
    assigneeRole: Optional[AssigneeRole] = None
    assigneeName: Optional[str] = None


def _out(t: dict) -> dict:
    return Ticket.model_validate(t).model_dump(mode="json")


def _notify_role(role: str) -> str:
    return role if role in ("engineer", "manager") else "manager"


@router.get("")
def list_tickets(sandboxId: str, role: Optional[str] = None, uid: str = Depends(current_uid)) -> list[dict]:
    require_member(sandboxId, uid)
    items = get_store().list_tickets(sandboxId)
    if role == "engineer":
        items = [t for t in items if t.get("assigneeRole") == "engineer"]
    return [_out(t) for t in items]


@router.post("")
def create_ticket(body: TicketCreate, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    nm = names(sbx)
    tid = store.next_ticket_id(body.sandboxId)
    t = body.model_dump(mode="json", exclude={"sandboxId"})
    t.update({"id": tid, "createdBy": "human", "createdAt": data.now_iso(),
              "dueAt": body.dueAt or data.iso_plus(120),
              "assigneeName": body.assigneeName or nm.get(body.assigneeRole, body.assigneeRole)})
    t = _out(t)
    store.put_ticket(body.sandboxId, t)
    case = store.get_case(body.sandboxId, body.caseId)
    if case is not None and tid not in case.get("ticketIds", []):
        case.setdefault("ticketIds", []).append(tid)
        store.put_case(body.sandboxId, case)
    notify(body.sandboxId, _notify_role(t["assigneeRole"]), "task_assigned", "New task", t["title"],
           {"caseId": t["caseId"], "ticketId": tid})
    return t


@router.patch("/{ticket_id}")
def patch_ticket(ticket_id: str, body: TicketPatch, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    t = load_ticket(body.sandboxId, ticket_id)
    nm = names(sbx)
    reassigned = False
    if body.status:
        t["status"] = body.status
    if body.assigneeRole and body.assigneeRole != t.get("assigneeRole"):
        t["assigneeRole"] = body.assigneeRole
        t["assigneeName"] = body.assigneeName or nm.get(body.assigneeRole, body.assigneeRole)
        reassigned = True
    elif body.assigneeName and body.assigneeName != t.get("assigneeName"):
        t["assigneeName"] = body.assigneeName
        reassigned = True
    t = _out(t)
    store.put_ticket(body.sandboxId, t)
    if reassigned:
        notify(body.sandboxId, _notify_role(t["assigneeRole"]), "task_assigned", "Task assigned to you", t["title"],
               {"caseId": t["caseId"], "ticketId": ticket_id})
    elif body.status == "done":
        notify(body.sandboxId, "manager", "task_completed", "Task completed", t["title"],
               {"caseId": t["caseId"], "ticketId": ticket_id})
    return t


@router.get("/{ticket_id}/progress")
def get_progress(ticket_id: str, sandboxId: str, uid: str = Depends(current_uid)) -> list[dict]:
    require_member(sandboxId, uid)
    load_ticket(sandboxId, ticket_id)
    return [Progress.model_validate(p).model_dump(mode="json") for p in get_store().get_progress(sandboxId, ticket_id)]


@router.put("/{ticket_id}/progress/{step_id}")
def put_progress(ticket_id: str, step_id: str, body: ProgressUpdate, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    t = load_ticket(body.sandboxId, ticket_id)
    if step_id not in {s["id"] for s in t.get("checklist", [])}:
        raise HTTPException(status_code=404, detail=f"Step {step_id} not in ticket {ticket_id}")
    p = Progress(stepId=step_id, done=body.done, result=body.result, note=body.note, reading=body.reading,
                 by=member_role(sbx, uid), at=data.now_iso()).model_dump(mode="json")
    store.put_progress(body.sandboxId, ticket_id, step_id, p)
    if t.get("status") == "open":
        t["status"] = "in_progress"
        store.put_ticket(body.sandboxId, t)
    return p


@router.post("/{ticket_id}/complete")
def complete(ticket_id: str, body: CompleteRequest, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    t = load_ticket(body.sandboxId, ticket_id)
    t["status"] = "done"
    t["report"] = body.report.model_dump(mode="json")
    t = _out(t)
    store.put_ticket(body.sandboxId, t)
    who = short_name(t.get("assigneeName") or names(sbx)["engineer"])
    case = store.get_case(body.sandboxId, t["caseId"])
    if case is not None:
        entry = {"at": data.now_iso(), "step": "task_completed", "summary": f"{who}: {body.report.summary}"[:300],
                 "provenance": "human"}
        store.append_trace(body.sandboxId, t["caseId"], entry)
    notify(body.sandboxId, "manager", "task_completed", "Task completed", f"{who} completed: {t['title']}",
           {"caseId": t["caseId"], "ticketId": ticket_id})
    return t
