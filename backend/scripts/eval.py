"""Golden-check eval for Optiflow LubeGuard against a running API.

Usage:
    python backend/scripts/eval.py --base-url http://localhost:8080
    python backend/scripts/eval.py --base-url https://<cloud run url> --token <Firebase ID token>

With AUTH_MODE=off the script sends X-Dev-Uid headers. Writes backend/eval_results.json.
All plant data is synthetic.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import httpx

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

from app.rules import pressure_path  # noqa: E402
from app.services import data  # noqa: E402

OUT = os.path.join(BACKEND, "eval_results.json")
OUT_OF_SCOPE = ["Who won the World Cup?", "What is the capital of France?"]
IN_SCOPE = "Why is the filter loading?"


class Api:
    def __init__(self, base: str, token: str | None, uid: str) -> None:
        h = {"X-Dev-Uid": uid}
        if token:
            h["Authorization"] = f"Bearer {token}"
        self.c = httpx.Client(base_url=base.rstrip("/"), headers=h, timeout=180)

    def get(self, path: str, **params):
        r = self.c.get(path, params=params)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: dict):
        r = self.c.post(path, json=body)
        r.raise_for_status()
        return r.json()


def new_case(mgr: Api, eng: Api) -> tuple[str, dict]:
    s = mgr.post("/api/demo/session", {"role": "manager"})
    eng.post("/api/demo/join", {"code": s["code"]})
    case = mgr.post(f"/api/cases/{s['caseId']}/investigate", {"sandboxId": s["sandboxId"]})
    return s["sandboxId"], case


def upload(mgr: Api, eng: Api, sid: str, sample: str) -> dict:
    t = mgr.post("/api/cases/C-0412/evidence-request", {"sandboxId": sid, "category": "material"})
    return eng.post("/api/evidence", {"sandboxId": sid, "ticketId": t["id"], "caseId": "C-0412", "kind": "photo",
                                      "storagePath": f"samples/{sample}.jpg", "sample": sample})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--token", default=os.environ.get("EVAL_ID_TOKEN"))
    args = ap.parse_args()
    mgr = Api(args.base_url, args.token, "eval-manager")
    eng = Api(args.base_url, args.token, "eval-engineer")
    checks: list[dict] = []

    def check(name: str, metric: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "metric": metric, "passed": bool(passed), "detail": detail})

    t0 = time.time()
    health = mgr.get("/api/health")
    sid, case = new_case(mgr, eng)
    mech = (case.get("pressurePath") or {}).get("mechanism")
    check("hero_r_t5_mechanism", "r_t5_accuracy", mech == "filter_loading", f"mechanism={mech}")

    m = case["diagnosis"]["matrix"] or {}
    expected = {"man": "G", "machine": "NG", "method": "NG", "material": "UNVERIFIED", "environment": "UNVERIFIED"}
    got = {k: (m.get(k) or {}).get("verdict") for k in expected}
    hits = sum(got[k] == v for k, v in expected.items())
    check("matrix_categories_after_investigate", "matrix_category_accuracy", hits == 5, f"{hits}/5 {got}")
    check("material_unverified_before_evidence", "matrix_category_accuracy", got["material"] == "UNVERIFIED",
          f"material={got['material']}; evidenceRequests={len(case['diagnosis']['evidenceRequests'])}")

    hazy = upload(mgr, eng, sid, "hazy_oil")
    check("hazy_photo_ng", "photo_verdict_accuracy", hazy["judged"]["verdict"] == "NG", hazy["judged"]["finding"])

    sid2, _ = new_case(mgr, eng)
    clear = upload(mgr, eng, sid2, "clear_oil")
    check("clear_photo_g", "photo_verdict_accuracy", clear["judged"]["verdict"] == "G", clear["judged"]["finding"])

    pw = pressure_path.classify(data.hourly("pump_wear")["series"])
    check("pump_wear_rules", "r_t5_accuracy", pw["mechanism"] == "pump_or_relief_valve", pw["evidence"])
    el = pressure_path.classify(data.hourly("external_leak")["series"])
    check("external_leak_rules", "r_t5_accuracy", el["mechanism"] == "external_leak", el["evidence"])

    after = mgr.get("/api/cases/C-0412", sandboxId=sid)
    ev_ids = [e["id"] for e in after.get("evidence", [])]
    valid = data.valid_citation_ids(ev_ids)
    cites = [c for cell in (after["diagnosis"]["matrix"] or {}).values() for c in cell.get("citations", [])]
    cites += [c for a in after["decision"]["actions"] for c in a.get("sopCitations", [])]
    ok = sum(c in valid for c in cites)
    rate = ok / len(cites) if cites else 0.0
    check("citation_validity", "citation_validity", rate >= 0.95 and len(cites) > 0, f"{ok}/{len(cites)} valid ({rate:.0%})")

    a = mgr.post("/api/ask", {"sandboxId": sid, "question": IN_SCOPE, "caseId": "C-0412"})
    check("ask_in_scope_cited", "refusal_correctness", (not a["refused"]) and len(a["citations"]) > 0,
          f"{len(a['citations'])} citations: {[c['id'] for c in a['citations']]}")
    refused = []
    for q in OUT_OF_SCOPE:
        r = mgr.post("/api/ask", {"sandboxId": sid, "question": q, "caseId": "C-0412"})
        refused.append(bool(r["refused"]) and r["answer"].startswith("0 sources, answer refused"))
    check("ask_out_of_scope_refused", "refusal_correctness", all(refused), f"{sum(refused)}/{len(refused)} refused")

    metrics: dict[str, float] = {}
    for c in checks:
        metrics.setdefault(c["metric"], [])  # type: ignore[arg-type]
        metrics[c["metric"]].append(c["passed"])  # type: ignore[union-attr]
    metrics_out = {k: round(sum(v) / len(v), 3) for k, v in metrics.items()}  # type: ignore[arg-type]
    metrics_out["citation_validity_rate"] = round(rate, 3)
    passed = sum(c["passed"] for c in checks)
    result = {"baseUrl": args.base_url, "at": datetime.now(timezone.utc).isoformat(), "aiMode": health.get("aiMode"),
              "store": health.get("store"), "passed": passed, "total": len(checks), "metrics": metrics_out,
              "seconds": round(time.time() - t0, 1), "checks": checks,
              "note": "Synthetic plant data; cached mode replays fixture states and canned judgements."}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    w = max(len(c["name"]) for c in checks)
    print(f"{'check'.ljust(w)}  result  detail")
    print("-" * (w + 60))
    for c in checks:
        print(f"{c['name'].ljust(w)}  {'PASS' if c['passed'] else 'FAIL'}    {c['detail'][:90]}")
    print("-" * (w + 60))
    print(f"{passed}/{len(checks)} passed (aiMode={health.get('aiMode')}, store={health.get('store')}); "
          f"metrics={metrics_out}; wrote {OUT}")
    return 0 if passed == len(checks) else 1


if __name__ == "__main__":
    sys.exit(main())
