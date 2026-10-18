"""Evidence upload: judge, store, re-structure the matrix, root cause, Advisor actions."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ..agents import advisor, judge
from ..agents.common import TraceWriter
from ..agents.investigator import restructure_with_evidence
from ..models import Case, Evidence, EvidenceUpload
from ..services import data
from ..services.auth import current_uid, member_role, require_member
from ..services.notify import notify
from ..services.store import get_store
from .common import load_case, load_ticket, names, short_name

router = APIRouter(tags=["evidence"])


@router.post("/evidence")
def upload_evidence(body: EvidenceUpload, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    case = load_case(body.sandboxId, body.caseId)
    ticket = load_ticket(body.sandboxId, body.ticketId)
    if ticket.get("caseId") != body.caseId:
        raise HTTPException(status_code=400, detail="Ticket does not belong to this case")
    nm = names(sbx)
    engineer = short_name(nm["engineer"])

    judged, judge_cached = judge.judge(body.kind, body.storagePath, body.sample, body.dataBase64, body.mimeType, body.note)
    ev_id = store.next_evidence_id(body.sandboxId)
    role = member_role(sbx, uid)
    evidence = Evidence.model_validate({
        "id": ev_id, "ticketId": body.ticketId, "caseId": body.caseId, "kind": body.kind,
        "storagePath": body.storagePath, "uploadedAt": data.now_iso(), "note": body.note,
        "judged": judged, "by": role if role in ("engineer", "manager") else "engineer",
    }).model_dump(mode="json")
    store.put_evidence(body.sandboxId, evidence)

    writer = TraceWriter(body.sandboxId, body.caseId)
    if body.kind == "voice":
        said = (judged.get("transcript") or "").split(" (")[0]
        writer.write("evidence_received", f'{engineer} voice note: "{said}"' if said else f"{engineer} voice note received",
                     "human")
    else:
        writer.write("evidence_received", f"{engineer} uploaded {'oil sample photo' if body.kind == 'photo' else 'gauge photo'}",
                     "human")
    label = {"photo": "Photo", "voice": "Voice note", "gauge": "Gauge"}[body.kind]
    verdict_word = {"G": "G", "NG": "NG", "UNVERIFIED": "UNVERIFIED"}[judged["verdict"]]
    writer.write("judge_evidence", f"{label}: {judged['finding'][:1].lower() + judged['finding'][1:]} ({verdict_word})")

    case = store.get_case(body.sandboxId, body.caseId) or case
    case.setdefault("evidence", [])
    case["evidence"] = [e for e in case["evidence"] if e["id"] != ev_id] + [evidence]

    what = "Oil photo" if body.kind == "photo" else ("Voice note" if body.kind == "voice" else "Gauge photo")
    finding = judged["finding"].split(":")[-1].strip() if judged["verdict"] == "NG" else judged["finding"]
    prev_diag = case.get("diagnosis") or {}
    prev_material = ((prev_diag.get("matrix") or {}).get("material") or {}).get("verdict")
    already_diagnosed = bool(prev_diag.get("rootCause")) and bool((case.get("decision") or {}).get("actions"))
    if already_diagnosed and prev_material == judged["verdict"]:
        # Corroborating evidence: cite it on Material and keep the existing diagnosis and actions.
        writer.write("corroborate", f"{label} corroborates Material {judged['verdict']}; diagnosis unchanged")
        latest = store.get_case(body.sandboxId, body.caseId) or case
        case["trace"] = latest.get("trace", case.get("trace", []))
        material = case["diagnosis"]["matrix"]["material"]
        if ev_id not in material.setdefault("citations", []):
            material["citations"].append(ev_id)
        case.setdefault("audit", {})["cached"] = bool(case.get("audit", {}).get("cached") or judge_cached)
        case = Case.model_validate(case).model_dump(mode="json")
        store.put_case(body.sandboxId, case)
        notify(body.sandboxId, "manager", "evidence_received", "Evidence received",
               f"{what} judged {judged['verdict']}: {finding}", {"caseId": body.caseId, "ticketId": body.ticketId})
        return evidence

    matrix, root, struct_cached = restructure_with_evidence(body.sandboxId, case, writer)
    water = "E-101A" in root["path"]
    actions, adv_cached = advisor.advise(matrix, root, water=water)
    impact = case.get("impact") or {}
    n_now = sum(1 for a in actions if a["timing"] == "now" and a["quadrant"] == "quick_win")
    now_ids = [a["id"] for a in actions if a["timing"] == "now" and a["quadrant"] == "quick_win"]
    can_now = f"{now_ids[0]} to {now_ids[-1]}" if len(now_ids) > 2 else " and ".join(now_ids)
    writer.write("advise", f"{len(actions)} actions with SOP citations" + (f"; {can_now} can run now" if n_now else ""))

    latest = store.get_case(body.sandboxId, body.caseId) or case
    case["trace"] = latest.get("trace", case.get("trace", []))
    diag = case.setdefault("diagnosis", {})
    diag["matrix"] = matrix
    diag["rootCause"] = root
    reqs = diag.get("evidenceRequests") or []
    if not any(r.get("ticketId") == body.ticketId for r in reqs) and ticket.get("evidenceRequest"):
        reqs.append(ticket["evidenceRequest"])
    diag["evidenceRequests"] = reqs
    approved = (case.get("decision") or {}).get("approvedActionIds") or []
    case["decision"] = {"actions": actions, "approvedActionIds": approved,
                        "timingNote": advisor.timing_note(actions, float(impact.get("exposureUsd") or 0))}
    if case.get("status") not in ("actions_approved", "verified"):
        case["status"] = "action_proposed"
    case.setdefault("audit", {})["cached"] = bool(judge_cached or struct_cached or adv_cached)
    if body.ticketId not in case.setdefault("ticketIds", []):
        case["ticketIds"].append(body.ticketId)
    case = Case.model_validate(case).model_dump(mode="json")
    store.put_case(body.sandboxId, case)

    if ticket.get("status") == "open":
        ticket["status"] = "in_progress"
        store.put_ticket(body.sandboxId, ticket)
    notify(body.sandboxId, "manager", "evidence_received", "Evidence received",
           f"{what} judged {judged['verdict']}: {finding}", {"caseId": body.caseId, "ticketId": body.ticketId})
    return evidence
