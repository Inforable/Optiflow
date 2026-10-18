"""Seeded, physics-informed synthetic data for the lube-oil console LO-01.

Scenarios (docs/NICHE_DECISION.md sections 4 and 6):
  hero         water ingress through cooler E-101A (F2): filter loading, header decay, level up
  pump_wear    P-104A wear or relief valve passing (F3): discharge and header down, vibration up
  external_leak  oil leak on the supply line (F4): level down, header slowly down

Outputs (backend/data/generated/):
  lube_readings_<scenario>.csv   1-minute data, 14 days (+24 h post-repair for hero); gitignored
  hourly_<scenario>.json         hourly series for charts and fixtures
  anomalies_<scenario>.json      precomputed per-tag anomaly flags (fallback for AI.DETECT_ANOMALIES)
Reference data (backend/data/): setpoints, oil_lab, autostart_tests, raci, authority, incidents.

All values are synthetic. Setpoints are SITE SETPOINTS for a fictional plant, not standards.
Run: python -I backend/scripts/generate_data.py
"""
from __future__ import annotations

import csv
import json
import os
from datetime import datetime, timedelta, timezone

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "data"))
GEN = os.path.join(DATA, "generated")
WIB = timezone(timedelta(hours=7))

START = datetime(2026, 10, 4, 2, 0, tzinfo=WIB)      # 14 days of history
ONSET = datetime(2026, 10, 13, 2, 0, tzinfo=WIB)     # fault starts (5 days before the case)
CASE_AT = datetime(2026, 10, 18, 2, 0, tzinfo=WIB)   # case opens
REPAIR_AT = datetime(2026, 10, 18, 3, 0, tzinfo=WIB)  # filter switched, cooler isolated
POST_END = datetime(2026, 10, 19, 3, 0, tzinfo=WIB)   # 24 h of post-repair data

UNITS = {
    "PT-104": "barg", "PDT-101": "bar", "PT-106": "barg", "IT-104A": "A", "VT-104A": "mm/s",
    "TT-102": "degC", "TT-103": "degC", "TT-104": "degC", "LT-101": "%", "TE-201": "degC",
    "TE-202": "degC", "TE-203": "degC", "TE-204": "degC", "ZT-205": "mm", "WATER-PPM": "ppm",
}
CHART_TAGS = ["PT-104", "PDT-101", "LT-101", "TE-201", "IT-104A", "PT-106", "VT-104A", "TT-102"]


def minutes(a: datetime, b: datetime) -> int:
    return int((b - a).total_seconds() // 60)


def ramp(t_min: np.ndarray, onset_min: int, dur_min: int, power: float = 1.3) -> np.ndarray:
    x = np.clip((t_min - onset_min) / dur_min, 0, 1)
    return x ** power


def simulate(scenario: str, rng: np.random.Generator) -> tuple[list[datetime], dict[str, np.ndarray]]:
    end = POST_END if scenario == "hero" else CASE_AT
    n = minutes(START, end)
    t = np.arange(n)
    ts = [START + timedelta(minutes=int(i)) for i in t]
    onset = minutes(START, ONSET)
    dur = minutes(ONSET, CASE_AT)
    repair = minutes(START, REPAIR_AT) if scenario == "hero" else n + 1
    day = 24 * 60
    load = 1 + 0.03 * np.sin(2 * np.pi * (t % day) / day)  # gentle daily load cycle
    noise = lambda s: rng.normal(0, s, n)  # noqa: E731

    r = np.zeros(n)
    water = np.full(n, 150.0)
    dp = np.full(n, 0.30)
    p_dis = 4.5 * load
    level = np.full(n, 70.0)
    current = 62 * load
    vib = np.full(n, 1.8)
    t_supply = np.full(n, 45.0) + 0.6 * (load - 1) * 10

    if scenario == "hero":
        r = ramp(t, onset, dur)
        water = 150 + 1650 * r
        dp = 0.30 + 0.60 * r
        level = 70 + 2.0 * r
        t_supply = t_supply + 0.5 * r
        post = t >= repair
        hrs = np.clip((t - repair) / 60, 0, None)
        dp = np.where(post, 0.30 + 0.02 * np.exp(-hrs), dp)  # clean element F-101B
        water = np.where(post, 500 + 1300 * np.exp(-hrs / 8), water)  # purifier pulling water down
        level = np.where(post, 72.0 - 0.3 * (1 - np.exp(-hrs / 10)), level)
        r = np.where(post, 0, r)
    elif scenario == "pump_wear":
        r = ramp(t, onset, dur)
        p_dis = p_dis - 0.6 * r
        current = current - 3 * r
        vib = 1.8 + 1.8 * r
    elif scenario == "external_leak":
        r = ramp(t, onset, dur, power=1.0)
        level = 70 - 6 * r

    header = (p_dis - 4.5) * 0.25 + 1.60 - (dp - 0.30) * 0.5
    if scenario == "external_leak":
        header = header - 0.12 * r
    if scenario == "hero":
        post = t >= repair
        hrs = np.clip((t - repair) / 60, 0, None)
        header = np.where(post, 1.60 - 0.3 * np.exp(-hrs * 6), header)
    starvation = np.clip((1.60 - header) / 0.3, 0, None)
    te201 = 88 + 6 * starvation + 0.8 * (load - 1) * 10
    if scenario == "hero":
        post = t >= repair
        hrs = np.clip((t - repair) / 60, 0, None)
        te201 = np.where(post, 88 + 6 * np.exp(-hrs / 1.5), te201)

    s = {
        "PT-104": header + noise(0.008),
        "PDT-101": dp + noise(0.006),
        "PT-106": p_dis + noise(0.02),
        "IT-104A": current + noise(0.4),
        "VT-104A": vib + noise(0.05),
        "TT-102": t_supply + noise(0.15),
        "TT-103": 32 + noise(0.2),
        "TT-104": 38 + noise(0.2),
        "LT-101": level + noise(0.05),
        "TE-201": te201 + noise(0.3),
        "TE-202": te201 - 1.5 + noise(0.3),
        "TE-203": 85 + 4 * starvation + noise(0.3),
        "TE-204": 80 + 3 * starvation + noise(0.3),
        "ZT-205": noise(0.005),
        "WATER-PPM": water + noise(15),
    }
    return ts, s


def hourly(ts: list[datetime], s: dict[str, np.ndarray], start: datetime) -> dict[str, list]:
    out: dict[str, list] = {}
    idx = [i for i, x in enumerate(ts) if x >= start and x.minute == 0]
    for tag in CHART_TAGS + ["WATER-PPM"]:
        out[tag] = [[ts[i].isoformat(), round(float(s[tag][i]), 3)] for i in idx]
    return out


def detect(ts: list[datetime], s: dict[str, np.ndarray]) -> list[dict]:
    """Simple stand-in for AI.DETECT_ANOMALIES: z-score of the last 6 h vs the healthy baseline."""
    base_end = minutes(START, ONSET)
    end = minutes(START, CASE_AT)
    res = []
    for tag in ["PT-104", "PDT-101", "LT-101", "TE-201", "IT-104A", "PT-106", "VT-104A", "TT-102"]:
        base = s[tag][:base_end]
        recent = s[tag][end - 360:end]
        z = abs(recent.mean() - base.mean()) / (base.std() + 1e-9)
        slope = (s[tag][end - 1] - s[tag][base_end]) / 5.0
        prob = float(min(0.999, 1 - np.exp(-z / 4))) if z > 3 else float(round(z / 10, 3))
        res.append({"tag": tag, "anomalous": bool(z > 6), "probability": round(prob, 3),
                    "slopePerDay": round(float(slope), 4), "z": round(float(z), 2)})
    return res


def write_csv(scenario: str, ts: list[datetime], s: dict[str, np.ndarray]) -> None:
    path = os.path.join(GEN, f"lube_readings_{scenario}.csv")
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["scenario", "tag", "ts", "value", "unit"])
        for tag, arr in s.items():
            for i in range(0, len(ts)):
                w.writerow([scenario, tag, ts[i].astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                            round(float(arr[i]), 4), UNITS[tag]])


def reference_data() -> None:
    setpoints = {
        "_note": "SITE SETPOINTS (synthetic) for the fictional plant. Not standards.",
        "PT-104": {"unit": "barg", "normal": 1.6, "low": 1.2, "lowLow": 0.8},
        "PDT-101": {"unit": "bar", "normal": 0.3, "change": 1.0},
        "PT-106": {"unit": "barg", "normal": 4.5},
        "IT-104A": {"unit": "A", "normal": 62, "fla": 70, "serviceFactor": 1.15},
        "VT-104A": {"unit": "mm/s", "normal": 1.8, "zoneA": 2.5, "zoneB": 4.0, "zoneC": 6.6},
        "TT-102": {"unit": "degC", "normal": 45, "high": 55},
        "LT-101": {"unit": "%", "normal": 70, "high": 78, "low": 60},
        "TE-201": {"unit": "degC", "normal": 88, "alarm": 115, "trip": 125},
        "TE-202": {"unit": "degC", "normal": 86.5, "alarm": 115, "trip": 125},
        "WATER-PPM": {"unit": "ppm", "siteAction": 500, "standardLimit": 1000},
        "autostartTestIntervalDays": 30,
    }
    oil_lab = {"_note": "Synthetic lab history.", "samples": [
        {"sampleDate": "2026-09-27", "waterPpm": 140, "iso4406": "17/15/12", "tanOverNew": 0.05,
         "viscosityChangePct": 1.2, "rpvotPctNew": 78, "foam": "10/0", "verdict": "normal"},
        {"sampleDate": "2026-08-27", "waterPpm": 160, "iso4406": "17/15/12", "tanOverNew": 0.04,
         "viscosityChangePct": 1.0, "rpvotPctNew": 80, "foam": "10/0", "verdict": "normal"}]}
    autostart = {"_note": "Synthetic test records.", "tests": [
        {"testDate": "2026-09-01", "pump": "P-104B", "result": "pass", "startSeconds": 2.1, "technician": "Joko"},
        {"testDate": "2026-09-01", "pump": "P-105", "result": "pass", "startSeconds": 2.8, "batteryV": 226, "technician": "Joko"},
        {"testDate": "2026-07-30", "pump": "P-104B", "result": "pass", "startSeconds": 2.0, "technician": "Andi"}]}
    raci = {"_note": "Synthetic RACI.", "rules": [
        {"assetClass": "lube_oil_filter", "failureMode": "*", "shift": "*", "R": "engineer", "A": "manager"},
        {"assetClass": "lube_oil_cooler", "failureMode": "*", "shift": "*", "R": "mechanical_shift_b", "A": "manager"},
        {"assetClass": "autostart_circuit", "failureMode": "*", "shift": "*", "R": "engineer", "A": "manager"},
        {"assetClass": "lube_oil", "failureMode": "*", "shift": "*", "R": "engineer", "A": "manager"}],
        "names": {"engineer": "Joko, Field Engineer", "mechanical_shift_b": "Mechanical Shift B", "manager": "Dimas, Maintenance Supervisor"}}
    authority = {"_note": "Synthetic delegation of authority.", "actions": {
        "filter_changeover": {"level": "shift", "needsCapex": False, "needsShutdown": False},
        "cooler_changeover": {"level": "shift", "needsCapex": False, "needsShutdown": False},
        "autostart_test": {"level": "shift", "needsCapex": False, "needsShutdown": False},
        "oil_purification": {"level": "plant", "needsCapex": False, "needsShutdown": False},
        "cooler_retube": {"level": "plant", "needsCapex": True, "needsShutdown": True},
        "piping_modification": {"level": "ho", "needsCapex": True, "needsShutdown": True}}}
    for name, obj in [("setpoints", setpoints), ("oil_lab", oil_lab), ("autostart_tests", autostart),
                      ("raci", raci), ("authority", authority)]:
        with open(os.path.join(DATA, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(obj, f, indent=2)

    modes = {
        "F1": ("Filter clogging", "lube_oil_filter"), "F2": ("Water ingress", "lube_oil"),
        "F3": ("Pump wear or relief valve passing", "lube_oil_pump"), "F4": ("External leak", "piping"),
        "F5": ("Oil cooler fouling", "lube_oil_cooler"), "F6": ("Standby pump failed to auto-start", "autostart_circuit"),
        "F7": ("Oxidation and varnish", "lube_oil"), "F8": ("P-104A bearing degradation", "lube_oil_pump"),
        "F9": ("Motor overheating", "lube_oil_pump"), "F10": ("Transmitter drift", "instrument"),
        "F11": ("Foaming or air entrainment", "lube_oil"), "F12": ("Bearing wipe", "bearing"),
    }
    rows = [
        ("INC-2022-031", "F12", "Journal bearing 1 wiped after slow header pressure decay went unnoticed; filter found loaded with emulsified sludge", "Material: water in oil; Machine: filter loading; Method: no trend alarm", "Retubed leaking cooler; added header pressure trend review", True, 72),
        ("INC-2023-008", "F12", "Bearing wipe on ST-02 after standby pump failed to start on low pressure", "Method: auto-start test overdue; Machine: contactor KM-104B failed", "Replaced contactor; enforced monthly auto-start test", True, 96),
        ("INC-2024-017", "F2", "Water ingress through cooler tube leak caught by hazy oil at visual check", "Environment/Machine: cooler tube leak; Material: water 1,600 ppm", "Isolated cooler, purified oil, retubed at outage", True, 6),
        ("INC-2021-044", "F12", "Thrust bearing damage after oil starvation during pump changeover", "Method: changeover procedure skipped; Machine: check valve stuck", "Rewrote changeover SOP; replaced check valve", True, 48),
        ("INC-2024-002", "F1", "Filter dP high from particulate after maintenance", "Material: particles after work", "Changed element; flushed", True, 2),
        ("INC-2023-021", "F3", "P-104A discharge pressure low, relief valve passing", "Machine: relief valve seat worn", "Replaced relief valve", True, 8),
        ("INC-2022-012", "F4", "Oil leak at header flange, reservoir level falling", "Machine: gasket failure", "Replaced gasket", True, 4),
        ("INC-2025-006", "F5", "Oil supply temperature high in dry season", "Environment: cooling water temperature; Machine: fouled cooler", "Cleaned cooler tubes", True, 10),
        ("INC-2023-030", "F10", "PT-104 read low; local gauge normal", "Method: transmitter calibration overdue", "Recalibrated transmitter", True, 1),
        ("INC-2024-025", "F8", "P-104A vibration rising to zone C; outer race defect", "Machine: bearing outer race", "Replaced bearing", True, 12),
        ("INC-2022-019", "F9", "P-104A motor hot; operator suspected filter, current showed mechanical load", "Machine: pump rubbing", "Realigned and repaired pump", True, 9),
        ("INC-2025-011", "F7", "RPVOT dropped toward 25% of new; varnish on filter", "Material: oxidation", "Oil top-up and varnish removal", True, 16),
        ("INC-2021-008", "F11", "Foam in reservoir sight glass after wrong top-up oil", "Material: contaminated make-up oil", "Drained and refilled", True, 20),
        ("INC-2024-031", "F6", "P-105 DC pump slow to start in test; weak battery", "Machine: battery cells", "Replaced battery bank", True, 3),
        ("INC-2023-015", "F2", "Gland steam leak raised water in oil", "Environment: gland seal leak", "Repaired gland seal; purified oil", True, 14),
        ("INC-2022-027", "F1", "Filter clogging recurred within a week", "Material: varnish not removed", "Varnish removal added to CAPA", False, 5),
        ("INC-2025-019", "F5", "Cooler fouling, TT-102 near high alarm", "Machine: biofouling", "Chemical cleaning", True, 7),
        ("INC-2021-033", "F3", "Pump wear after long run hours", "Machine: impeller wear", "Overhauled pump", True, 18),
        ("INC-2024-008", "F9", "Motor overheating from blocked fan cowl", "Environment: dust", "Cleaned fan cowl", True, 2),
        ("INC-2023-040", "F10", "LT-101 drift after transmitter water ingress", "Machine: transmitter housing", "Replaced transmitter", True, 2),
        ("INC-2022-005", "F8", "Coupling misalignment raised P-104A vibration", "Method: alignment after maintenance", "Laser alignment", True, 6),
        ("INC-2025-024", "F4", "Small leak at filter cover O-ring", "Machine: O-ring", "Replaced O-ring", True, 1),
        ("INC-2024-019", "F2", "Condensation in reservoir during monsoon", "Environment: humidity; Machine: breather", "Replaced breather desiccant", True, 4),
        ("INC-2023-002", "F6", "Auto-start test skipped two months; found relay K3 coil open", "Method: test overdue; Machine: relay", "Replaced relay; test reminder", True, 2),
        ("INC-2021-020", "F7", "Dark oil and high TAN", "Material: oxidation", "Oil change", True, 24),
        ("INC-2022-040", "F11", "Air entrainment from suction leak", "Machine: suction flange", "Fixed suction leak", True, 6),
        ("INC-2024-036", "F1", "Filter element collapsed at high dP", "Method: changeover delayed", "Changeover at 1.0 bar enforced", True, 8),
        ("INC-2025-002", "F12", "Bearing temperature spike during start-up", "Method: start-up oil temperature too low", "Revised start-up checklist", True, 30),
        ("INC-2023-027", "F3", "Relief valve chatter", "Machine: spring fatigue", "Replaced spring", True, 3),
        ("INC-2024-040", "F5", "Cooler water-side scaling", "Environment: water chemistry", "Descaled cooler", True, 9),
    ]
    incidents = [{"id": r[0], "failureMode": r[1], "failureModeLabel": modes[r[1]][0], "assetClass": modes[r[1]][1],
                  "description": r[2], "rootCause4m1e": r[3], "capa": r[4], "capaEffective": r[5], "downtimeH": r[6]}
                 for r in rows]
    with open(os.path.join(DATA, "incidents.json"), "w", encoding="utf-8") as f:
        json.dump({"_note": "Synthetic incidents for the fictional plant.", "failureModes": {k: v[0] for k, v in modes.items()},
                   "incidents": incidents}, f, indent=2)


def main() -> None:
    os.makedirs(GEN, exist_ok=True)
    rng = np.random.default_rng(20261018)
    for scenario in ["hero", "pump_wear", "external_leak"]:
        ts, s = simulate(scenario, rng)
        write_csv(scenario, ts, s)
        with open(os.path.join(GEN, f"hourly_{scenario}.json"), "w", encoding="utf-8") as f:
            json.dump({"scenario": scenario, "interval": "1h", "series": hourly(ts, s, ONSET - timedelta(days=1)),
                       "postRepairFrom": REPAIR_AT.isoformat() if scenario == "hero" else None}, f)
        with open(os.path.join(GEN, f"anomalies_{scenario}.json"), "w", encoding="utf-8") as f:
            json.dump({"scenario": scenario, "method": "fallback z-score vs healthy baseline (stand-in for AI.DETECT_ANOMALIES)",
                       "tags": detect(ts, s)}, f, indent=2)
        print(scenario, "rows/tag:", len(ts))
    reference_data()
    print("done")


if __name__ == "__main__":
    main()
