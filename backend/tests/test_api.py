"""End-to-end API tests in memory + cached mode (no Gemini, no GCP)."""
import pytest
from fastapi.testclient import TestClient

from app.agents.common import validate_matrix
from app.main import app
from app.services import data

M = {"X-Dev-Uid": "test-manager"}
E = {"X-Dev-Uid": "test-engineer"}


@pytest.fixture()
def client():
    return TestClient(app)


def _session(c):
    s = c.post("/api/demo/session", json={"role": "manager"}, headers=M).json()
    c.post("/api/demo/join", json={"code": s["code"]}, headers=E)
    return s["sandboxId"]


def test_health(client):
    h = client.get("/api/health").json()
    assert h["ok"] and h["aiMode"] == "cached" and h["store"] == "memory"


def test_full_hero_journey(client):
    sid = _session(client)
    case = client.get(f"/api/cases/C-0412?sandboxId={sid}", headers=M).json()
    assert case["status"] == "open" and case["sandboxId"] == sid
    notes = client.get(f"/api/notifications?sandboxId={sid}&role=manager", headers=M).json()
    assert notes[0]["event"] == "case_opened"

    case = client.post("/api/cases/C-0412/investigate", json={"sandboxId": sid}, headers=M).json()
    assert case["status"] == "awaiting_evidence"
    assert case["diagnosis"]["matrix"]["material"]["verdict"] == "UNVERIFIED"
    assert case["pressurePath"]["mechanism"] == "filter_loading"
    open_fx = data.load_fixture("case_C0412_open")
    assert [t["step"] for t in case["trace"]] == [t["step"] for t in open_fx["trace"]]
    assert case["diagnosis"]["matrix"] == open_fx["diagnosis"]["matrix"]

    t1 = client.post("/api/cases/C-0412/evidence-request", json={"sandboxId": sid, "category": "material"},
                     headers=M).json()
    assert t1["id"] == "T-1" and t1["type"] == "evidence_request"
    assert t1["checklist"] == data.load_fixture("tickets")[0]["checklist"]
    eng = client.get(f"/api/tickets?sandboxId={sid}&role=engineer", headers=E).json()
    assert [t["id"] for t in eng] == ["T-1"]

    ev = client.post("/api/evidence", json={"sandboxId": sid, "ticketId": "T-1", "caseId": "C-0412", "kind": "photo",
                                            "storagePath": "samples/hazy_oil.jpg", "sample": "hazy_oil"}, headers=E).json()
    assert ev["id"] == "EV-1" and ev["judged"]["verdict"] == "NG"
    case = client.get(f"/api/cases/C-0412?sandboxId={sid}", headers=M).json()
    assert case["status"] == "action_proposed"
    m = case["diagnosis"]["matrix"]
    assert m["material"]["verdict"] == "NG" and m["environment"]["verdict"] == "NG"
    assert "EV-1" in m["material"]["citations"]
    assert case["diagnosis"]["rootCause"]["path"] == ["E-101A", "OIL", "F-101A", "HEADER", "BRG-1"]
    ev_fx = data.load_fixture("case_C0412_evidence")
    assert case["decision"]["actions"] == ev_fx["decision"]["actions"]
    assert case["decision"]["timingNote"] == ev_fx["decision"]["timingNote"]

    voice = client.post("/api/evidence", json={"sandboxId": sid, "ticketId": "T-1", "caseId": "C-0412", "kind": "voice",
                                               "storagePath": "x.webm", "sample": "voice_hazy"}, headers=E).json()
    assert voice["id"] == "EV-2" and voice["judged"]["transcript"].startswith("Olinya keruh")

    res = client.post("/api/cases/C-0412/approve", json={"sandboxId": sid, "actionIds": ["A1", "A2", "A3"]},
                      headers=M).json()
    tickets = res["tickets"]
    assert [(t["id"], t["actionId"]) for t in tickets] == [("T-2", "A1"), ("T-3", "A3"), ("T-4", "A2")]
    assert tickets[2]["assigneeName"] == "Mechanical Shift B"
    p = client.put(f"/api/tickets/T-2/progress/s1", json={"sandboxId": sid, "done": True, "result": "pass"},
                   headers=E).json()
    assert p["stepId"] == "s1" and p["done"]
    assert client.get(f"/api/tickets/T-2/progress?sandboxId={sid}", headers=E).json()[0]["stepId"] == "s1"
    done = client.post("/api/tickets/T-2/complete",
                       json={"sandboxId": sid, "report": {"summary": "Switched to F-101B", "condition": "fair"}},
                       headers=E).json()
    assert done["status"] == "done"

    case = client.post("/api/cases/C-0412/verify", json={"sandboxId": sid}, headers=M).json()
    assert case["status"] == "verified"
    assert case["verification"] == data.load_fixture("case_C0412_verified")["verification"]
    g = client.get(f"/api/kg?sandboxId={sid}&caseId=C-0412", headers=M).json()
    assert g["highlight"] == ["E-101A", "OIL", "F-101A", "HEADER", "BRG-1"]
    assert any(n["id"] == "INC-2026-0412" for n in g["nodes"])

    a = client.post("/api/ask", json={"sandboxId": sid, "question": "Why is the filter loading?", "caseId": "C-0412"},
                    headers=M).json()
    assert not a["refused"] and a["citations"]
    r = client.post("/api/ask", json={"sandboxId": sid, "question": "Who won the World Cup?", "caseId": "C-0412"},
                    headers=M).json()
    assert r["refused"] and r["answer"].startswith("0 sources, answer refused")

    assert client.post("/api/demo/reset", json={"sandboxId": sid}, headers=M).json() == {"ok": True}
    assert client.get(f"/api/cases/C-0412?sandboxId={sid}", headers=M).json()["status"] == "open"
    assert client.get(f"/api/tickets?sandboxId={sid}", headers=M).json() == []


def test_clear_oil_control_is_good(client):
    sid = _session(client)
    client.post("/api/cases/C-0412/investigate", json={"sandboxId": sid}, headers=M)
    client.post("/api/cases/C-0412/evidence-request", json={"sandboxId": sid, "category": "material"}, headers=M)
    ev = client.post("/api/evidence", json={"sandboxId": sid, "ticketId": "T-1", "caseId": "C-0412", "kind": "photo",
                                            "storagePath": "samples/clear_oil.jpg", "sample": "clear_oil"}, headers=E).json()
    assert ev["judged"]["verdict"] == "G"
    case = client.get(f"/api/cases/C-0412?sandboxId={sid}", headers=M).json()
    assert case["diagnosis"]["matrix"]["material"]["verdict"] == "G"


def test_manual_ticket_and_patch(client):
    sid = _session(client)
    t = client.post("/api/tickets", json={"sandboxId": sid, "title": "Check sight glass", "caseId": "C-0412"},
                    headers=M).json()
    assert t["createdBy"] == "human" and t["id"] == "T-1"
    t = client.patch(f"/api/tickets/{t['id']}", json={"sandboxId": sid, "assigneeRole": "mechanical_shift_b"},
                     headers=M).json()
    assert t["assigneeName"] == "Mechanical Shift B"
    notes = client.get(f"/api/notifications?sandboxId={sid}", headers=M).json()
    nid = notes[-1]["id"]
    assert client.post(f"/api/notifications/{nid}/read", json={"sandboxId": sid}, headers=M).json() == {"ok": True}


def test_invalid_citations_downgrade():
    m = {c: {"verdict": "NG", "evidence": "x", "citations": ["R-T5"]} for c in
         ("man", "machine", "method", "material", "environment")}
    m["man"]["citations"] = ["SOP-LO-99 §9"]
    m["method"]["citations"] = []
    out, down = validate_matrix(m)
    assert out["man"]["verdict"] == "UNVERIFIED" and out["method"]["verdict"] == "UNVERIFIED"
    assert out["machine"]["verdict"] == "NG"
    assert set(down) == {"man", "method"}


def test_unknown_sandbox_404(client):
    assert client.get("/api/cases/C-0412?sandboxId=sbx_nope", headers=M).status_code == 404


def test_spa_and_fixtures_routes(client):
    assert client.get("/fixtures/kg.json").status_code == 200
    assert client.get("/api/does-not-exist").status_code == 404
