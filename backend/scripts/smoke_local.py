"""Full hero journey against a running API (DEV_PLAN section 7), with assertions.

Usage:
    python backend/scripts/smoke_local.py --base-url http://localhost:8080
Works with AUTH_MODE=off (X-Dev-Uid headers) or with --token <Firebase ID token>.
"""
from __future__ import annotations

import argparse
import os
import sys
import time

import httpx


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--token", default=os.environ.get("SMOKE_ID_TOKEN"))
    args = ap.parse_args()
    base = args.base_url.rstrip("/")

    def client(uid: str) -> httpx.Client:
        h = {"X-Dev-Uid": uid}
        if args.token:
            h["Authorization"] = f"Bearer {args.token}"
        return httpx.Client(base_url=base, headers=h, timeout=180)

    mgr, eng = client("smoke-manager"), client("smoke-engineer")
    t0 = time.time()

    def step(name: str, cond: bool, detail: str = "") -> None:
        print(f"[{time.time() - t0:5.1f}s] {'OK  ' if cond else 'FAIL'} {name} {detail}")
        if not cond:
            raise SystemExit(1)

    def ok(r: httpx.Response) -> dict:
        if r.status_code >= 400:
            print(r.status_code, r.text[:500])
        r.raise_for_status()
        return r.json()

    h = ok(mgr.get("/api/health"))
    step("health", h["ok"], f"aiMode={h['aiMode']} store={h['store']}")

    s = ok(mgr.post("/api/demo/session", json={"role": "manager"}))
    sid, code = s["sandboxId"], s["code"]
    step("session", sid.startswith("sbx_") and len(code) == 6, f"{sid} code={code}")
    j = ok(eng.post("/api/demo/join", json={"code": code}))
    step("join", j["role"] == "engineer" and j["sandboxId"] == sid)

    case = ok(mgr.post("/api/cases/C-0412/investigate", json={"sandboxId": sid}))
    m = case["diagnosis"]["matrix"]
    step("investigate", case["status"] == "awaiting_evidence" and m["material"]["verdict"] == "UNVERIFIED"
         and m["machine"]["verdict"] == "NG" and m["method"]["verdict"] == "NG",
         f"trace={len(case['trace'])} R-T5={case['pressurePath']['mechanism']} autostart={case['autostart']['lastTestDays']}d")

    t1 = ok(mgr.post("/api/cases/C-0412/evidence-request", json={"sandboxId": sid, "category": "material"}))
    step("evidence-request", t1["type"] == "evidence_request" and t1["assigneeRole"] == "engineer", t1["id"])
    tasks = ok(eng.get("/api/tickets", params={"sandboxId": sid, "role": "engineer"}))
    step("engineer sees task", any(t["id"] == t1["id"] for t in tasks))

    ev = ok(eng.post("/api/evidence", json={"sandboxId": sid, "ticketId": t1["id"], "caseId": "C-0412", "kind": "photo",
                                            "storagePath": f"sandboxes/{sid}/evidence/{t1['id']}/hazy.jpg",
                                            "sample": "hazy_oil"}))
    step("evidence hazy_oil", ev["judged"]["verdict"] == "NG", ev["judged"]["finding"])
    case = ok(mgr.get("/api/cases/C-0412", params={"sandboxId": sid}))
    m = case["diagnosis"]["matrix"]
    step("material flips NG", case["status"] == "action_proposed" and m["material"]["verdict"] == "NG"
         and m["environment"]["verdict"] == "NG", f"root={case['diagnosis']['rootCause']['path']}")
    ids = [a["id"] for a in case["decision"]["actions"]]
    step("advisor actions", len(ids) >= 3 and all(a["sopCitations"] for a in case["decision"]["actions"]), str(ids))

    approve_ids = [a for a in ("A1", "A2", "A3") if a in ids] or ids[:3]
    res = ok(mgr.post("/api/cases/C-0412/approve", json={"sandboxId": sid, "actionIds": approve_ids}))
    step("approve", len(res["tickets"]) == len(approve_ids),
         ", ".join(f"{t['id']}:{t['actionId']}:{t['assigneeName']}" for t in res["tickets"]))
    safety = next((t for t in res["tickets"] if t["type"] == "safety_test"), res["tickets"][0])

    p = ok(eng.put(f"/api/tickets/{safety['id']}/progress/{safety['checklist'][0]['id']}",
                   json={"sandboxId": sid, "done": True, "result": "pass", "reading": "2.1 s"}))
    step("progress put", p["done"])
    done = ok(eng.post(f"/api/tickets/{safety['id']}/complete",
                       json={"sandboxId": sid, "report": {"summary": "P-104B started in 2.1 s; P-105 started",
                                                          "condition": "good"}}))
    step("complete", done["status"] == "done")

    case = ok(mgr.post("/api/cases/C-0412/verify", json={"sandboxId": sid}))
    step("verify", case["status"] == "verified" and case["verification"]["status"] == "verified_effective",
         str([(c["tag"], c["last"], c["passed"]) for c in case["verification"]["checks"]]))

    g = ok(mgr.get("/api/kg", params={"sandboxId": sid, "caseId": "C-0412"}))
    step("kg", g["highlight"] == ["E-101A", "OIL", "F-101A", "HEADER", "BRG-1"], f"{len(g['nodes'])} nodes")

    a = ok(mgr.post("/api/ask", json={"sandboxId": sid, "question": "Why is the filter loading?", "caseId": "C-0412"}))
    step("ask in scope", not a["refused"] and len(a["citations"]) > 0, f"{len(a['citations'])} citations")
    r = ok(mgr.post("/api/ask", json={"sandboxId": sid, "question": "Who won the World Cup?", "caseId": "C-0412"}))
    step("ask refused", r["refused"], r["answer"][:40])

    notes = ok(mgr.get("/api/notifications", params={"sandboxId": sid, "role": "manager"}))
    step("manager notifications", len(notes) >= 4, str([n["event"] for n in notes]))
    print(f"SMOKE PASSED in {time.time() - t0:.1f}s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
