"""Build the knowledge graph, fixtures and JSON schema from generated data.

Every fixture is validated against backend/app/models.py, so fixtures and the
backend can never drift apart. Run after generate_data.py:
    python -I backend/scripts/build_fixtures.py
Writes: backend/data/kg.json, fixtures/*.json, contracts/case.schema.json
"""
from __future__ import annotations

import copy
import json
import os
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from app.models import Case, KgGraph, Ticket, AskResponse, Notification  # noqa: E402

DATA = os.path.join(ROOT, "backend", "data")
GEN = os.path.join(DATA, "generated")
FIX = os.path.join(ROOT, "fixtures")
CASE_AT = "2026-10-18T02:00:00+07:00"
COST_PER_HOUR = 29721


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump(obj, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)


# ---------------------------------------------------------------- knowledge graph
def build_kg(incidents):
    nodes, edges = [], []

    def n(id_, type_, label, **props):
        nodes.append({"id": id_, "type": type_, "label": label, "props": props})

    def e(s, t, type_):
        edges.append({"source": s, "target": t, "type": type_})

    n("LO-01", "system", "Lube-oil console LO-01 (ST-01)")
    comps = [
        ("TK-01", "Reservoir", "reservoir"), ("OIL", "Lube oil (ISO VG 32 turbine oil)", "fluid"),
        ("P-104A", "Main AC lube-oil pump", "pump"), ("P-104B", "Standby AC lube-oil pump", "pump"),
        ("P-105", "DC emergency lube-oil pump", "pump"), ("F-101A", "Duplex filter side A", "filter"),
        ("F-101B", "Duplex filter side B", "filter"), ("E-101A", "Oil cooler A", "cooler"),
        ("E-101B", "Oil cooler B", "cooler"), ("PCV-101", "Header pressure control valve", "valve"),
        ("HEADER", "Lube-oil header", "header"), ("BRG-1", "Journal bearing 1", "bearing"),
        ("BRG-2", "Journal bearing 2", "bearing"), ("BRG-T", "Thrust bearing", "bearing"),
        ("PSL-104", "Low header pressure switch (1.2 barg)", "switch"),
        ("PSLL-104", "Low-low header pressure switch (0.8 barg)", "switch"),
        ("K3", "Standby start relay", "relay"), ("K5", "Emergency start relay", "relay"),
        ("KM-104A", "Contactor P-104A", "contactor"), ("KM-104B", "Contactor P-104B", "contactor"),
        ("KM-105", "DC contactor P-105", "contactor"), ("BAT-220V", "220 VDC battery", "battery"),
        ("MCC-2", "Motor control centre 2", "mcc"), ("TR-2", "Plant transformer TR-2", "transformer"),
    ]
    for cid, label, kind in comps:
        n(cid, "component", label, kind=kind)
        e("LO-01", cid, "HAS_PART")
    for s, t in [("TK-01", "P-104A"), ("TK-01", "P-104B"), ("TK-01", "P-105"), ("P-104A", "F-101A"),
                 ("P-104B", "F-101A"), ("F-101A", "E-101A"), ("F-101B", "E-101B"), ("E-101A", "PCV-101"),
                 ("E-101B", "PCV-101"), ("PCV-101", "HEADER"), ("P-105", "HEADER"), ("HEADER", "BRG-1"),
                 ("HEADER", "BRG-2"), ("HEADER", "BRG-T")]:
        e(s, t, "FEEDS")
    for b in ["BRG-1", "BRG-2", "BRG-T"]:
        e(b, "TK-01", "DRAINS_TO")
    for s, t, ty in [("TK-01", "OIL", "HOLDS"), ("OIL", "F-101A", "FLOWS_THROUGH"), ("OIL", "E-101A", "FLOWS_THROUGH"),
                     ("OIL", "HEADER", "FLOWS_THROUGH"), ("E-101A", "OIL", "EXCHANGES_HEAT_WITH")]:
        e(s, t, ty)
    # electrical auto-start chain
    for s, t, ty in [("PSL-104", "HEADER", "SENSES"), ("PSLL-104", "HEADER", "SENSES"), ("PSL-104", "K3", "TRIGGERS"),
                     ("K3", "KM-104B", "ENERGIZES"), ("KM-104B", "P-104B", "STARTS"), ("PSLL-104", "K5", "TRIGGERS"),
                     ("K5", "KM-105", "ENERGIZES"), ("KM-105", "P-105", "STARTS"), ("BAT-220V", "KM-105", "POWERS"),
                     ("MCC-2", "KM-104A", "POWERS"), ("MCC-2", "KM-104B", "POWERS"), ("TR-2", "MCC-2", "POWERS"),
                     ("KM-104A", "P-104A", "STARTS")]:
        e(s, t, ty)
    tags = [("PT-104", "Header pressure", "HEADER"), ("PDT-101", "Filter differential pressure", "F-101A"),
            ("PT-106", "P-104A discharge pressure", "P-104A"), ("IT-104A", "P-104A motor current", "P-104A"),
            ("VT-104A", "P-104A vibration", "P-104A"), ("TT-102", "Oil temperature after cooler", "E-101A"),
            ("TT-103", "Cooling water in", "E-101A"), ("TT-104", "Cooling water out", "E-101A"),
            ("LT-101", "Reservoir level", "TK-01"), ("TE-201", "Journal bearing 1 temperature", "BRG-1"),
            ("TE-202", "Journal bearing 2 temperature", "BRG-2"), ("TE-203", "Thrust active pad temperature", "BRG-T"),
            ("TE-204", "Thrust inactive pad temperature", "BRG-T"), ("ZT-205", "Thrust position", "BRG-T"),
            ("WATER-PPM", "Water in oil (lab)", "OIL")]
    for tid, label, comp in tags:
        n(tid, "tag", f"{tid} {label}")
        e(comp, tid, "MEASURED_BY")
    fms = load(os.path.join(DATA, "incidents.json"))["failureModes"]
    for fid, label in fms.items():
        n(fid, "failure_mode", f"{fid} {label}")
    for comp, fm in [("F-101A", "F1"), ("OIL", "F2"), ("E-101A", "F2"), ("P-104A", "F3"), ("HEADER", "F4"),
                     ("TK-01", "F4"), ("E-101A", "F5"), ("PSL-104", "F6"), ("K3", "F6"), ("KM-104B", "F6"),
                     ("OIL", "F7"), ("P-104A", "F8"), ("P-104A", "F9"), ("PT-104", "F10"), ("OIL", "F11"),
                     ("BRG-1", "F12"), ("BRG-2", "F12"), ("BRG-T", "F12")]:
        e(comp, fm, "CAN_FAIL_AS")
    rules = [("R-T1", "Turbine oil limits (ASTM D4378 via ExxonMobil guide)", ["F2", "F7", "F11"]),
             ("R-T2", "ISO 4406 cleanliness code", ["F7"]),
             ("R-T3", "Bearing temperature vs babbitt limit", ["F12"]),
             ("R-T4", "Standby and DC pump auto-start readiness (API 614 logic)", ["F6"]),
             ("R-T5", "Pressure-path classifier", ["F1", "F2", "F3", "F4", "F5", "F10"]),
             ("R-P1", "Pump vibration zones (ISO 10816-7)", ["F8"]),
             ("R-P8", "Motor overheating: load vs cooling vs supply", ["F9"]),
             ("R4", "Voltage unbalance (NEMA MG-1)", ["F9"])]
    for rid, label, fs in rules:
        n(rid, "rule", f"{rid} {label}")
        for f in fs:
            e(f, rid, "DETECTED_BY")
    sops = [("SOP-LO-01 §2", "Normal operating values"), ("SOP-LO-02 §1", "When to change over the filter"),
            ("SOP-LO-02 §3.1", "Prepare standby filter element"), ("SOP-LO-02 §3.2", "Switch filter transfer valve"),
            ("SOP-LO-02 §3.3", "Confirm filter dP and header pressure"), ("SOP-LO-02 §4", "Inspect removed element"),
            ("SOP-LO-03 §2", "Switch to standby cooler"), ("SOP-LO-03 §3", "Cooler leak check"),
            ("SOP-LO-03 §5", "Plug or retube cooler at outage"), ("SOP-LO-04 §2", "Reservoir drain sample and photo"),
            ("SOP-LO-04 §3", "Hot-plate crackle test"), ("SOP-LO-04 §4", "Lab sample"),
            ("SOP-LO-05 §1", "Auto-start test interval (30 days)"), ("SOP-LO-05 §2", "P-104B auto-start test"),
            ("SOP-LO-05 §3", "P-105 DC pump test"), ("SOP-LO-06 §3", "Run purifier until water below 500 ppm"),
            ("SOP-LO-07 §2", "Bearing temperature: check oil supply"), ("SOP-LO-08 §1", "Pump vibration check"),
            ("SOP-LO-08 §2", "Motor current check"), ("SOP-LO-08 §4", "Relief valve check")]
    for sid, label in sops:
        n(sid, "sop", f"{sid} {label}")
    for fm, sid in [("F1", "SOP-LO-02 §3.2"), ("F1", "SOP-LO-02 §4"), ("F2", "SOP-LO-04 §2"), ("F2", "SOP-LO-03 §2"),
                    ("F2", "SOP-LO-03 §3"), ("F2", "SOP-LO-06 §3"), ("F2", "SOP-LO-03 §5"), ("F5", "SOP-LO-03 §2"),
                    ("F6", "SOP-LO-05 §2"), ("F6", "SOP-LO-05 §3"), ("F6", "SOP-LO-05 §1"), ("F3", "SOP-LO-08 §4"),
                    ("F8", "SOP-LO-08 §1"), ("F9", "SOP-LO-08 §2"), ("F12", "SOP-LO-07 §2"), ("F10", "SOP-LO-01 §2"),
                    ("F7", "SOP-LO-04 §4"), ("F11", "SOP-LO-04 §2")]:
        e(fm, sid, "MITIGATED_BY")
    for inc in incidents:
        n(inc["id"], "incident", f'{inc["id"]} {inc["failureModeLabel"]}', description=inc["description"],
          capa=inc["capa"], capaEffective=inc["capaEffective"], downtimeH=inc["downtimeH"])
        e(inc["id"], inc["failureMode"], "HAD_MODE")
    return {"nodes": nodes, "edges": edges, "highlight": []}


# ---------------------------------------------------------------- case states
def trace(at_sec, step, summary, prov="ai"):
    return {"at": f"2026-10-18T02:00:{at_sec:02d}+07:00", "step": step, "summary": summary, "provenance": prov}


def build_cases(hourly, anomalies, incidents):
    series_all = hourly["series"]
    pre = {tag: [p for p in pts if p[0] <= CASE_AT] for tag, pts in series_all.items()}
    chart = {t: pre[t] for t in ["PT-104", "PDT-101", "LT-101", "TE-201", "IT-104A", "PT-106", "VT-104A", "TT-102"]}
    setpoints = {"PT-104": {"unit": "barg", "low": 1.2, "lowLow": 0.8}, "PDT-101": {"unit": "bar", "change": 1.0},
                 "LT-101": {"unit": "%", "high": 78, "low": 60}, "TE-201": {"unit": "degC", "alarm": 115, "trip": 125},
                 "TT-102": {"unit": "degC", "high": 55}, "VT-104A": {"unit": "mm/s", "high": 4.0},
                 "IT-104A": {"unit": "A", "high": 80.5}, "PT-106": {"unit": "barg"}}
    det_tags = [{k: t[k] for k in ("tag", "anomalous", "probability", "slopePerDay")} for t in anomalies["tags"]]
    wipes = [i["downtimeH"] for i in incidents if i["failureMode"] == "F12" and i["id"] in
             ("INC-2022-031", "INC-2023-008", "INC-2021-044")]
    med = statistics.median(wipes)
    seed = {
        "id": "C-0412", "sandboxId": "sbx_fixture",
        "asset": {"id": "ST-01", "name": "Steam turbine ST-01, Unit 2", "system": "LO-01 lube-oil console"},
        "title": "Lube-oil header pressure decay", "status": "open", "openedAt": CASE_AT,
        "syntheticDataNote": "Synthetic demo plant. SITE SETPOINTS are not standards.",
        "readings": {"interval": "1h", "series": chart, "setpoints": setpoints, "postRepairFrom": None},
        "detection": {"method": "BigQuery AI.DETECT_ANOMALIES (TimesFM 2.5), per signal",
                      "tags": det_tags,
                      "driftCheck": {"verdict": "physical", "reason": "PT-104, PDT-101 and LT-101 move together; not a single-sensor drift"}},
        "impact": {"lossPerMinUsd": 0, "exposureUsd": round(med * COST_PER_HOUR),
                   "formula": f"{med:.0f} h median downtime of similar bearing-wipe incidents x US$29,721/h (problem brief: US$67.2M / 2,261 h)",
                   "assumptions": ["Median of INC-2022-031 (72 h), INC-2023-008 (96 h), INC-2021-044 (48 h); synthetic incidents",
                                   "No production loss yet: turbine still at full load"]},
        "diagnosis": {"matrix": None, "rootCause": None, "evidenceRequests": []},
        "evidence": [], "decision": {"actions": [], "approvedActionIds": []}, "ticketIds": [],
        "verification": {"status": "pending", "checks": []},
        "trace": [trace(0, "case_opened", "Detection opened case C-0412: 4 lube-oil signals anomalous", "ai")],
        "audit": {"model": "gemini-3.8-flash", "promptVersion": "v1", "cached": False},
    }
    case_open = copy.deepcopy(seed)
    case_open["status"] = "awaiting_evidence"
    case_open["pressurePath"] = {"ruleId": "R-T5", "mechanism": "filter_loading", "label": "Filter loading",
                                 "evidence": "PT-104 down 0.06 barg/day, PDT-101 up 0.12 bar/day, PT-106 flat; LT-101 rising (+1.9%)"}
    case_open["autostart"] = {"ruleId": "R-T4", "marginToPslBar": 0.1, "lastTestDays": 47, "sopIntervalDays": 30,
                              "verdict": "NG", "label": "Auto-start test overdue; 0.1 bar margin to standby start"}
    case_open["diagnosis"] = {
        "matrix": {
            "man": {"verdict": "G", "evidence": "Operator log follows SOP-LO-02; filter change planned for next shift", "citations": ["SOP-LO-02 §1"], "provenance": "ai"},
            "machine": {"verdict": "NG", "evidence": "Filter F-101A loading (R-T5). Pump P-104A healthy: current flat, vibration 1.8 mm/s zone A (R-P1)", "citations": ["R-T5", "R-P1"], "provenance": "ai"},
            "method": {"verdict": "NG", "evidence": "P-104B and P-105 auto-start last tested 47 days ago vs 30-day interval; header is 0.1 bar above standby start (R-T4)", "citations": ["R-T4", "SOP-LO-05 §1"], "provenance": "ai"},
            "material": {"verdict": "UNVERIFIED", "evidence": "Last lab sample 21 days ago was normal (140 ppm water). Reservoir level rising suggests something is entering the oil", "citations": ["R-T1"], "provenance": "ai"},
            "environment": {"verdict": "UNVERIFIED", "evidence": "Cooling-water side of E-101A not checked; oil temperature after cooler normal", "citations": ["R-T5"], "provenance": "ai"},
        },
        "rootCause": None,
        "evidenceRequests": [{"category": "material", "instruction": "Take an oil sample from the reservoir drain into a clear bottle and photograph it against a light. Add a short voice note.", "sopRef": "SOP-LO-04 §2", "ticketId": None}],
    }
    case_open["trace"] = seed["trace"] + [
        trace(3, "query_signals", "Pulled 6 days of PT-104, PDT-101, LT-101, TE-201, IT-104A, PT-106, VT-104A"),
        trace(5, "classify_pressure_path", "R-T5: header down, filter dP up, discharge flat: filter loading"),
        trace(7, "get_asset_context", "F-101A element in service 41 days; P-104A last serviced 63 days ago"),
        trace(9, "get_pump_motor_health", "P-104A 1.8 mm/s (zone A), 62 A of 70 A FLA: pump healthy"),
        trace(11, "check_autostart_readiness", "Last auto-start test 47 days ago (SOP 30 days); margin 0.1 bar to PSL-104"),
        trace(13, "get_oil_lab_results", "Last lab sample 21 days ago: 140 ppm water, ISO 17/15/12: normal then"),
        trace(15, "search_similar_incidents", "Similar: INC-2022-031 (bearing wipe, emulsified sludge), INC-2024-017 (cooler water ingress)"),
        trace(17, "get_graph_neighbourhood", "F-101A, OIL, E-101A, HEADER, BRG-1 and linked SOP sections"),
        trace(21, "structure_matrix", "4M+1E: Machine NG, Method NG, Material UNVERIFIED, Environment UNVERIFIED"),
        trace(22, "evidence_request", "Material unverified: request oil sample photo (SOP-LO-04 §2)"),
    ]
    case_ev = copy.deepcopy(case_open)
    case_ev["status"] = "action_proposed"
    case_ev["ticketIds"] = ["T-1"]
    case_ev["diagnosis"]["evidenceRequests"][0]["ticketId"] = "T-1"
    case_ev["evidence"] = [
        {"id": "EV-1", "ticketId": "T-1", "caseId": "C-0412", "kind": "photo",
         "storagePath": "samples/hazy_oil.jpg", "uploadedAt": "2026-10-18T02:31:40+07:00", "note": None,
         "judged": {"verdict": "NG", "finding": "Oil is not clear and bright: milky haze, free water suspected",
                    "reason": "Turbine oil should be clear and bright; a hazy or milky appearance indicates water (SOP-LO-04 §2)",
                    "confidence": 0.9, "transcript": None}, "by": "engineer"},
        {"id": "EV-2", "ticketId": "T-1", "caseId": "C-0412", "kind": "voice",
         "storagePath": "samples/voice_hazy.webm", "uploadedAt": "2026-10-18T02:31:52+07:00", "note": None,
         "judged": {"verdict": "NG", "finding": "Technician reports cloudy, milk-like oil", "reason": "Spoken observation matches water contamination",
                    "confidence": 0.8, "transcript": "Olinya keruh, seperti susu. (The oil is cloudy, like milk.)"}, "by": "engineer"},
    ]
    m = case_ev["diagnosis"]["matrix"]
    m["material"] = {"verdict": "NG", "evidence": "Engineer photo: oil not clear and bright, milky haze; free water suspected (above 0.1% limit for steam turbines likely)", "citations": ["R-T1", "EV-1", "EV-2", "SOP-LO-04 §2"], "provenance": "human"}
    m["environment"] = {"verdict": "NG", "evidence": "Water source: cooling water entering through a tube leak in oil cooler E-101A (level rising, emulsified sludge on filter)", "citations": ["R-T5", "SOP-LO-03 §3", "INC-2024-017"], "provenance": "ai"}
    m["machine"]["evidence"] = "Filter F-101A loaded with emulsified sludge (R-T5); cooler E-101A tube leak suspected. Pump P-104A healthy (R-P1)"
    case_ev["diagnosis"]["rootCause"] = {
        "text": "Cooling water is leaking through oil cooler E-101A, emulsifying the oil; the sludge loads filter F-101A and starves the header, raising bearing 1 temperature. Changing the filter alone would treat the symptom.",
        "path": ["E-101A", "OIL", "F-101A", "HEADER", "BRG-1"]}
    case_ev["decision"] = {"actions": [
        {"id": "A1", "title": "Switch duplex filter to F-101B under load", "category": "machine", "quadrant": "quick_win", "authority": "shift", "timing": "now",
         "sopCitations": ["SOP-LO-02 §3.1", "SOP-LO-02 §3.2", "SOP-LO-02 §3.3"], "steps": ["Vent and fill F-101B", "Turn transfer valve slowly to F-101B", "Confirm PDT-101 below 0.4 bar and PT-104 recovering"], "assigneeRole": "engineer", "ticketType": "corrective"},
        {"id": "A2", "title": "Isolate cooler E-101A and run on E-101B", "category": "environment", "quadrant": "quick_win", "authority": "shift", "timing": "now",
         "sopCitations": ["SOP-LO-03 §2", "SOP-LO-03 §3"], "steps": ["Open E-101B oil and water valves", "Close E-101A oil side, then water side", "Compare oil vs water pressure; photograph gauges"], "assigneeRole": "mechanical_shift_b", "ticketType": "corrective"},
        {"id": "A3", "title": "Run auto-start test on P-104B and P-105 now", "category": "method", "quadrant": "quick_win", "authority": "shift", "timing": "now",
         "sopCitations": ["SOP-LO-05 §2", "SOP-LO-05 §3"], "steps": ["Test PSL-104 start of P-104B", "Test PSLL-104 start of P-105 with trip bypass", "Record start times and battery voltage"], "assigneeRole": "engineer", "ticketType": "safety_test"},
        {"id": "A4", "title": "Start oil purifier until water below 500 ppm", "category": "material", "quadrant": "major", "authority": "plant", "timing": "now",
         "sopCitations": ["SOP-LO-06 §3"], "steps": ["Connect vacuum dehydrator", "Run until two samples 4 h apart are below 500 ppm"], "assigneeRole": "engineer", "ticketType": "corrective"},
        {"id": "A5", "title": "Plug or retube cooler E-101A at next planned shutdown", "category": "machine", "quadrant": "major", "authority": "plant", "timing": "next_shutdown",
         "sopCitations": ["SOP-LO-03 §5"], "steps": ["Pressure-test tubes", "Plug or retube", "Pressure-test before return to service"], "assigneeRole": "mechanical_shift_b", "ticketType": "corrective"},
    ], "approvedActionIds": [], "timingNote": "A1 to A3 now with no downtime. A5 at the next planned shutdown rather than run to failure (exposure US$2.14M)."}
    case_ev["trace"] = case_open["trace"] + [
        {"at": "2026-10-18T02:31:40+07:00", "step": "evidence_received", "summary": "Joko uploaded oil sample photo (synced after offline capture)", "provenance": "human"},
        {"at": "2026-10-18T02:31:52+07:00", "step": "evidence_received", "summary": "Joko voice note: \"Olinya keruh, seperti susu\"", "provenance": "human"},
        {"at": "2026-10-18T02:31:58+07:00", "step": "judge_evidence", "summary": "Photo: not clear and bright, free water suspected (NG)", "provenance": "ai"},
        {"at": "2026-10-18T02:32:04+07:00", "step": "structure_matrix", "summary": "Material NG, Environment NG; root cause: cooler E-101A leaking water", "provenance": "ai"},
        {"at": "2026-10-18T02:32:10+07:00", "step": "advise", "summary": "5 actions with SOP citations; A1 to A3 can run now", "provenance": "ai"},
    ]
    case_ver = copy.deepcopy(case_ev)
    case_ver["status"] = "verified"
    case_ver["ticketIds"] = ["T-1", "T-2", "T-3", "T-4"]
    case_ver["decision"]["approvedActionIds"] = ["A1", "A2", "A3"]
    full = {t: series_all[t] for t in chart}
    case_ver["readings"]["series"] = full
    case_ver["readings"]["postRepairFrom"] = hourly["postRepairFrom"]
    last = {t: full[t][-1][1] for t in full}
    checks = [("PT-104", 1.6, 0.05), ("PDT-101", 0.3, 0.05), ("TE-201", 88.0, 2.0)]
    case_ver["verification"] = {"status": "verified_effective", "checks": [
        {"tag": t, "baseline": b, "band": band, "last": last[t], "passed": abs(last[t] - b) <= band} for t, b, band in checks]}
    case_ver["trace"] = case_ev["trace"] + [
        {"at": "2026-10-18T02:40:00+07:00", "step": "approve", "summary": "Dimas approved A1, A2, A3", "provenance": "human"},
        {"at": "2026-10-18T03:05:00+07:00", "step": "task_completed", "summary": "Joko: filter switched to F-101B; PDT-101 0.32 bar", "provenance": "human"},
        {"at": "2026-10-19T03:00:00+07:00", "step": "verify", "summary": "Post-repair data back to baseline for 24 h: verified effective", "provenance": "ai"},
    ]
    return seed, case_open, case_ev, case_ver


def build_tickets():
    base = dict(caseId="C-0412", createdAt="2026-10-18T02:01:30+07:00")
    return [
        {**base, "id": "T-1", "type": "evidence_request", "title": "Oil sample photo from reservoir drain", "component": "TK-01",
         "priority": "high", "dueAt": "2026-10-18T02:30:00+07:00", "estimateMin": 15, "assigneeRole": "engineer",
         "assigneeName": "Joko, Field Engineer", "status": "done", "createdBy": "ai",
         "checklist": [{"id": "s1", "text": "Flush the drain valve for 5 seconds", "sopRef": "SOP-LO-04 §2"},
                       {"id": "s2", "text": "Fill a clear bottle to three quarters", "sopRef": "SOP-LO-04 §2"},
                       {"id": "s3", "text": "Photograph the bottle against a light", "sopRef": "SOP-LO-04 §2"},
                       {"id": "s4", "text": "Record a short voice note of what you see", "sopRef": "SOP-LO-04 §2"}],
         "evidenceRequest": {"category": "material", "instruction": "Take an oil sample from the reservoir drain into a clear bottle and photograph it against a light. Add a short voice note.", "sopRef": "SOP-LO-04 §2", "ticketId": "T-1"},
         "report": {"summary": "Oil milky and hazy; sample photographed", "condition": "poor"}},
        {**base, "id": "T-2", "type": "corrective", "title": "Switch duplex filter to F-101B under load", "component": "F-101A",
         "priority": "high", "dueAt": "2026-10-18T03:30:00+07:00", "estimateMin": 30, "assigneeRole": "engineer",
         "assigneeName": "Joko, Field Engineer", "status": "done", "createdBy": "ai", "actionId": "A1", "createdAt": "2026-10-18T02:40:05+07:00",
         "checklist": [{"id": "s1", "text": "Vent and fill F-101B until oil is clear at the vent", "sopRef": "SOP-LO-02 §3.1"},
                       {"id": "s2", "text": "Turn transfer valve slowly to F-101B, watch PT-104", "sopRef": "SOP-LO-02 §3.2"},
                       {"id": "s3", "text": "Confirm PDT-101 below 0.4 bar; photograph the gauge", "sopRef": "SOP-LO-02 §3.3"},
                       {"id": "s4", "text": "Photograph the removed element", "sopRef": "SOP-LO-02 §4"}],
         "evidenceRequest": None, "report": {"summary": "Switched to F-101B; PDT-101 0.32 bar; element coated with milky sludge", "condition": "fair"}},
        {**base, "id": "T-3", "type": "safety_test", "title": "Auto-start test P-104B and P-105", "component": "PSL-104",
         "priority": "high", "dueAt": "2026-10-18T04:00:00+07:00", "estimateMin": 45, "assigneeRole": "engineer",
         "assigneeName": "Joko, Field Engineer", "status": "open", "createdBy": "ai", "actionId": "A3", "createdAt": "2026-10-18T02:40:05+07:00",
         "checklist": [{"id": "s1", "text": "Inform control room", "sopRef": "SOP-LO-05 §2"},
                       {"id": "s2", "text": "Operate PSL-104 test; confirm K3, KM-104B and P-104B start within 3 s", "sopRef": "SOP-LO-05 §2"},
                       {"id": "s3", "text": "Check BAT-220V voltage; operate PSLL-104 test with trip bypass; confirm P-105 starts", "sopRef": "SOP-LO-05 §3"},
                       {"id": "s4", "text": "Record start times and battery voltage", "sopRef": "SOP-LO-05 §4"}],
         "evidenceRequest": None, "report": None},
        {**base, "id": "T-4", "type": "corrective", "title": "Isolate cooler E-101A, run on E-101B", "component": "E-101A",
         "priority": "high", "dueAt": "2026-10-18T03:30:00+07:00", "estimateMin": 40, "assigneeRole": "mechanical_shift_b",
         "assigneeName": "Mechanical Shift B", "status": "in_progress", "createdBy": "ai", "actionId": "A2", "createdAt": "2026-10-18T02:40:05+07:00",
         "checklist": [{"id": "s1", "text": "Open E-101B oil and cooling-water valves", "sopRef": "SOP-LO-03 §2"},
                       {"id": "s2", "text": "Close E-101A oil side, then water side", "sopRef": "SOP-LO-03 §2"},
                       {"id": "s3", "text": "Compare oil vs cooling-water pressure; photograph gauges", "sopRef": "SOP-LO-03 §3"}],
         "evidenceRequest": None, "report": None},
    ]


def build_notifications():
    return [
        {"id": "N-1", "toRole": "manager", "event": "case_opened", "title": "New case C-0412", "body": "Lube-oil header pressure decay on ST-01", "ref": {"caseId": "C-0412"}, "read": False, "at": "2026-10-18T02:00:00+07:00"},
        {"id": "N-2", "toRole": "engineer", "event": "evidence_requested", "title": "Evidence requested", "body": "Oil sample photo from reservoir drain (SOP-LO-04 §2)", "ref": {"caseId": "C-0412", "ticketId": "T-1"}, "read": False, "at": "2026-10-18T02:01:30+07:00"},
        {"id": "N-3", "toRole": "manager", "event": "evidence_received", "title": "Evidence received", "body": "Oil photo judged NG: free water suspected", "ref": {"caseId": "C-0412", "ticketId": "T-1"}, "read": False, "at": "2026-10-18T02:31:58+07:00"},
        {"id": "N-4", "toRole": "engineer", "event": "task_assigned", "title": "New task", "body": "Switch duplex filter to F-101B under load", "ref": {"caseId": "C-0412", "ticketId": "T-2"}, "read": False, "at": "2026-10-18T02:40:05+07:00"},
    ]


def build_ask():
    return [
        {"question": "Why is the filter loading?", "caseId": "C-0412", "response": {
            "answer": "Header pressure is falling while filter dP rises and pump discharge stays flat, so the pressure-path rule points to filter loading. The reservoir level is also rising, which means something is entering the oil. In this system the likely source is cooling water through a tube leak in cooler E-101A, which emulsifies the oil and loads the filter (as in INC-2024-017). Confirm with an oil sample photo per SOP-LO-04 §2.",
            "citations": [{"id": "R-T5", "type": "rule", "label": "R-T5 Pressure-path classifier"},
                          {"id": "F2", "type": "failure_mode", "label": "F2 Water ingress"},
                          {"id": "E-101A", "type": "component", "label": "Oil cooler A"},
                          {"id": "INC-2024-017", "type": "incident", "label": "INC-2024-017 Water ingress"},
                          {"id": "SOP-LO-04 §2", "type": "sop", "label": "SOP-LO-04 §2 Reservoir drain sample and photo"}],
            "refused": False}},
        {"question": "Who won the World Cup?", "caseId": "C-0412", "response": {
            "answer": "0 sources, answer refused. I only answer from this plant's lube-oil knowledge graph and SOPs.",
            "citations": [], "refused": True}},
    ]


def main():
    os.makedirs(FIX, exist_ok=True)
    os.makedirs(os.path.join(ROOT, "contracts"), exist_ok=True)
    incidents = load(os.path.join(DATA, "incidents.json"))["incidents"]
    kg = build_kg(incidents)
    KgGraph.model_validate(kg)
    dump(kg, os.path.join(DATA, "kg.json"))
    hourly = load(os.path.join(GEN, "hourly_hero.json"))
    anomalies = load(os.path.join(GEN, "anomalies_hero.json"))
    seed, c_open, c_ev, c_ver = build_cases(hourly, anomalies, incidents)
    for name, c in [("case_C0412_seed", seed), ("case_C0412_open", c_open), ("case_C0412_evidence", c_ev), ("case_C0412_verified", c_ver)]:
        Case.model_validate(c)
        dump(c, os.path.join(FIX, f"{name}.json"))
    tickets = build_tickets()
    for t in tickets:
        Ticket.model_validate(t)
    dump(tickets, os.path.join(FIX, "tickets.json"))
    notes = build_notifications()
    for nn in notes:
        Notification.model_validate(nn)
    dump(notes, os.path.join(FIX, "notifications.json"))
    ask = build_ask()
    for a in ask:
        AskResponse.model_validate(a["response"])
    dump(ask, os.path.join(FIX, "ask_examples.json"))
    kg_fix = copy.deepcopy(kg)
    kg_fix["highlight"] = c_ev["diagnosis"]["rootCause"]["path"]
    dump(kg_fix, os.path.join(FIX, "kg.json"))
    dump(Case.model_json_schema(), os.path.join(ROOT, "contracts", "case.schema.json"))
    print("kg nodes", len(kg["nodes"]), "edges", len(kg["edges"]))
    print("fixtures written; exposure", seed["impact"]["exposureUsd"])


if __name__ == "__main__":
    main()
