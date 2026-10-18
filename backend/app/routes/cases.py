"""Case routes: get, investigate, evidence request, approve, verify."""
from __future__ import annotations

import copy
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException

from ..agents import advisor, investigator
from ..models import ApproveRequest, Case, EvidenceRequestBody, SandboxRequest, Ticket
from ..rules import verify as verify_rule
from ..services import data
from ..services.auth import current_uid, require_member
from ..services.notify import notify
from ..services.store import get_store
from .common import load_case, names, short_name

router = APIRouter(prefix="/cases", tags=["cases"])

EVIDENCE_TICKETS = {
    "material": {"title": "Oil sample photo from reservoir drain", "component": "TK-01", "estimateMin": 15,
                 "checklist": [("Flush the drain valve for 5 seconds", "SOP-LO-04 §2"),
                               ("Fill a clear bottle to three quarters", "SOP-LO-04 §2"),
                               ("Photograph the bottle against a light", "SOP-LO-04 §2"),
                               ("Record a short voice note of what you see", "SOP-LO-04 §2")]},
    "environment": {"title": "Cooler E-101A gauge photos", "component": "E-101A", "estimateMin": 20,
                    "checklist": [("Read oil-side pressure at E-101A", "SOP-LO-03 §3"),
                                  ("Read cooling-water-side pressure at E-101A", "SOP-LO-03 §3"),
                                  ("Photograph both gauges", "SOP-LO-03 §3")]},
    "machine": {"title": "Removed filter element photo", "component": "F-101A", "estimateMin": 15,
                "checklist": [("Photograph the removed element", "SOP-LO-02 §4")]},
    "method": {"title": "Auto-start test record photo", "component": "PSL-104", "estimateMin": 10,
               "checklist": [("Photograph the last auto-start test record", "SOP-LO-05 §4")]},
    "man": {"title": "Operator log photo", "component": "LO-01", "estimateMin": 10,
            "checklist": [("Photograph the operator log for the last two shifts", "SOP-LO-02 §1")]},
}


def _out(case: dict) -> dict:
    return Case.model_validate(case).model_dump(mode="json")


@router.get("/{case_id}")
def get_case(case_id: str, sandboxId: str, uid: str = Depends(current_uid)) -> dict:
    require_member(sandboxId, uid)
    return _out(load_case(sandboxId, case_id))


@router.post("/{case_id}/investigate")
def investigate(case_id: str, body: SandboxRequest, uid: str = Depends(current_uid)) -> dict:
    require_member(body.sandboxId, uid)
    load_case(body.sandboxId, case_id)
    case = investigator.investigate(body.sandboxId, case_id)
    return _out(case)


@router.post("/{case_id}/evidence-request")
def evidence_request(case_id: str, body: EvidenceRequestBody, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    case = load_case(body.sandboxId, case_id)
    diag = case.setdefault("diagnosis", {"matrix": None, "rootCause": None, "evidenceRequests": []})
    reqs = diag.setdefault("evidenceRequests", [])
    req = next((r for r in reqs if r["category"] == body.category), None)
    if req and req.get("ticketId"):
        existing = store.get_ticket(body.sandboxId, req["ticketId"])
        if existing:
            return Ticket.model_validate(existing).model_dump(mode="json")
    if req is None:
        req = {"category": body.category, **investigator.EVIDENCE_REQUESTS[body.category], "ticketId": None}
        reqs.append(req)
    tpl = EVIDENCE_TICKETS[body.category]
    tid = store.next_ticket_id(body.sandboxId)
    req["ticketId"] = tid
    nm = names(sbx)
    ticket = {
        "id": tid, "type": "evidence_request", "title": tpl["title"], "caseId": case_id,
        "component": tpl["component"], "priority": "high", "dueAt": data.iso_plus(30),
        "estimateMin": tpl["estimateMin"], "assigneeRole": "engineer", "assigneeName": nm["engineer"],
        "status": "open",
        "checklist": [{"id": f"s{i}", "text": t, "sopRef": ref} for i, (t, ref) in enumerate(tpl["checklist"], 1)],
        "evidenceRequest": copy.deepcopy(req), "createdBy": "ai", "createdAt": data.now_iso(),
        "report": None, "actionId": None,
    }
    ticket = Ticket.model_validate(ticket).model_dump(mode="json")
    store.put_ticket(body.sandboxId, ticket)
    if tid not in case.setdefault("ticketIds", []):
        case["ticketIds"].append(tid)
    store.put_case(body.sandboxId, case)
    notify(body.sandboxId, "engineer", "evidence_requested", "Evidence requested",
           f"{tpl['title']} ({req['sopRef']})", {"caseId": case_id, "ticketId": tid})
    return ticket


def _ticket_templates() -> dict[str, dict]:
    return {t["actionId"]: t for t in data.load_fixture("tickets") if t.get("actionId")}


def _ticket_for_action(sid: str, case_id: str, action: dict, tid: str, nm: dict) -> dict:
    tpl = _ticket_templates().get(action["id"])
    now = data.now_iso()
    if tpl and tpl["title"].split()[0].lower() in action["title"].lower():
        due_offset = int((data.parse_ts(tpl["dueAt"]) - data.parse_ts(tpl["createdAt"])) / timedelta(minutes=1))
        base = {"title": tpl["title"], "component": tpl["component"], "priority": tpl["priority"],
                "estimateMin": tpl["estimateMin"], "checklist": tpl["checklist"], "dueAt": data.iso_plus(due_offset)}
    else:
        cites = action.get("sopCitations") or []
        steps = action.get("steps") or []
        checklist = [{"id": f"s{i}", "text": st, "sopRef": (cites[min(i - 1, len(cites) - 1)] if cites else None)}
                     for i, st in enumerate(steps, 1)]
        base = {"title": action["title"], "component": advisor.KIND_COMPONENT.get(advisor.action_kind(action), "LO-01"),
                "priority": "high" if action["timing"] == "now" else "medium",
                "estimateMin": 30 if action["timing"] == "now" else 480, "checklist": checklist,
                "dueAt": data.iso_plus(60 if action["timing"] == "now" else 60 * 24 * 14)}
    role = action.get("assigneeRole", "engineer")
    return {"id": tid, "type": action.get("ticketType", "corrective"), "caseId": case_id,
            "assigneeRole": role, "assigneeName": nm.get(role, role), "status": "open",
            "evidenceRequest": None, "createdBy": "ai", "createdAt": now, "report": None,
            "actionId": action["id"], **base}


@router.post("/{case_id}/approve")
def approve(case_id: str, body: ApproveRequest, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    case = load_case(body.sandboxId, case_id)
    actions = {a["id"]: a for a in (case.get("decision") or {}).get("actions", [])}
    unknown = [a for a in body.actionIds if a not in actions]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown action ids: {', '.join(unknown)}")
    already = set(case["decision"].get("approvedActionIds") or [])
    chosen = [actions[a] for a in body.actionIds if a not in already]
    # engineer tasks first (matches fixtures/tickets.json ordering)
    chosen.sort(key=lambda a: (a.get("assigneeRole") != "engineer", body.actionIds.index(a["id"])))
    nm = names(sbx)
    tickets = []
    for action in chosen:
        tid = store.next_ticket_id(body.sandboxId)
        t = Ticket.model_validate(_ticket_for_action(body.sandboxId, case_id, action, tid, nm)).model_dump(mode="json")
        store.put_ticket(body.sandboxId, t)
        tickets.append(t)
        case.setdefault("ticketIds", []).append(tid)
        if t["assigneeRole"] in ("engineer", "manager"):
            notify(body.sandboxId, t["assigneeRole"], "task_assigned", "New task", t["title"],
                   {"caseId": case_id, "ticketId": tid})
    approved = list(dict.fromkeys(list(already) + body.actionIds))
    case["decision"]["approvedActionIds"] = approved
    case["status"] = "actions_approved"
    entry = {"at": data.now_iso(), "step": "approve",
             "summary": f"{short_name(nm['manager'])} approved {', '.join(body.actionIds)}", "provenance": "human"}
    case.setdefault("trace", []).append(entry)
    store.put_case(body.sandboxId, case)
    if tickets:
        notify(body.sandboxId, "manager", "action_approved", "Actions approved",
               f"{', '.join(body.actionIds)} approved; {len(tickets)} tickets created", {"caseId": case_id})
    return {"tickets": tickets}


@router.post("/{case_id}/verify")
def verify(case_id: str, body: SandboxRequest, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(body.sandboxId, uid)
    store = get_store()
    case = load_case(body.sandboxId, case_id)
    full = data.hourly("hero")
    series = case["readings"]["series"]
    for tag, pts in series.items():
        last_ts = data.parse_ts(pts[-1][0]) if pts else None
        extra = [p for p in full["series"].get(tag, []) if last_ts is None or data.parse_ts(p[0]) > last_ts]
        pts.extend(extra)
    case["readings"]["postRepairFrom"] = full.get("postRepairFrom")
    result = verify_rule.check(series, case["readings"]["postRepairFrom"])
    case["verification"] = result
    ok = result["status"] == "verified_effective"
    case["status"] = "verified" if ok else "reopened"
    summary = ("Post-repair data back to baseline for 24 h: verified effective" if ok else
               "Post-repair data outside baseline: case reopened (" +
               ", ".join(c["tag"] for c in result["checks"] if not c["passed"]) + ")")
    case.setdefault("trace", []).append({"at": data.now_iso(), "step": "verify", "summary": summary, "provenance": "ai"})
    if ok:
        root = (case.get("diagnosis") or {}).get("rootCause") or {}
        water = "E-101A" in (root.get("path") or [])
        inc_id = "INC-2026-" + case_id.split("-")[-1]
        node = {"id": inc_id, "type": "incident",
                "label": f"{inc_id} {'Water ingress' if water else 'Filter clogging'} (verified fix)",
                "props": {"description": root.get("text", case["title"]),
                          "capa": "; ".join(a["title"] for a in case["decision"]["actions"]
                                            if a["id"] in case["decision"].get("approvedActionIds", [])),
                          "capaEffective": True, "downtimeH": 0, "caseId": case_id, "verified": True}}
        edges = [{"source": inc_id, "target": "F2" if water else "F1", "type": "HAD_MODE"}]
        if water:
            edges.append({"source": inc_id, "target": "E-101A", "type": "OCCURRED_ON"})
        extra = sbx.get("kgExtra") or {"nodes": [], "edges": []}
        extra["nodes"] = [n for n in extra.get("nodes", []) if n["id"] != inc_id] + [node]
        extra["edges"] = [e for e in extra.get("edges", []) if e["source"] != inc_id] + edges
        store.update_sandbox(body.sandboxId, {"kgExtra": extra})
        for t in store.list_tickets(body.sandboxId):
            if t.get("caseId") == case_id and t.get("status") == "done":
                t["status"] = "verified"
                store.put_ticket(body.sandboxId, t)
    store.put_case(body.sandboxId, case)
    notify(body.sandboxId, "manager", "verification_result",
           "Verified effective" if ok else "Case reopened", summary, {"caseId": case_id})
    return _out(case)
