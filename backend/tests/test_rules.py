"""Unit tests for the deterministic domain rules."""
from app.rules import autostart, bearings, loss, oil_limits, pressure_path, pump_motor, verify
from app.services import data


def _pre_repair(scenario: str) -> dict:
    return data.case_series_window(data.hourly(scenario)["series"], end_iso=data.CASE_AT, days=6)


def test_hero_pressure_path_is_filter_loading():
    r = pressure_path.classify(_pre_repair("hero"), end_iso=data.CASE_AT)
    assert r["mechanism"] == "filter_loading"
    assert r["ruleId"] == "R-T5"
    assert r["evidence"] == "PT-104 down 0.06 barg/day, PDT-101 up 0.12 bar/day, PT-106 flat; LT-101 rising (+1.9%)"


def test_hero_with_confirmed_haze_is_water_ingress():
    r = pressure_path.classify(_pre_repair("hero"), end_iso=data.CASE_AT, oil_haze=True)
    assert r["mechanism"] == "water_ingress"


def test_pump_wear_scenario():
    r = pressure_path.classify(data.hourly("pump_wear")["series"])
    assert r["mechanism"] == "pump_or_relief_valve"


def test_external_leak_scenario():
    r = pressure_path.classify(data.hourly("external_leak")["series"])
    assert r["mechanism"] == "external_leak"


def test_instrument_drift_on_gauge_mismatch():
    r = pressure_path.classify(_pre_repair("hero"), end_iso=data.CASE_AT, gauge_reading_barg=1.6)
    assert r["mechanism"] == "instrument_drift"


def test_normal_on_flat_series():
    pts = [[f"2026-10-1{d}T{h:02d}:00:00+07:00", 1.6] for d in range(3, 8) for h in range(24)]
    flat = {t: [[ts, v] for ts, _ in pts] for t, v in
            {"PT-104": 1.6, "PDT-101": 0.3, "PT-106": 4.5, "LT-101": 70, "TT-102": 45, "TE-201": 88, "IT-104A": 62}.items()}
    assert pressure_path.classify(flat)["mechanism"] == "normal"


def test_hero_autostart_ng_47_days_01_bar():
    pt = data.hourly("hero")["series"]["PT-104"]
    last = [p for p in pt if p[0] <= data.CASE_AT][-1][1]
    r = autostart.check(last, data.autostart_tests(), data.CASE_AT)
    assert r["verdict"] == "NG"
    assert r["lastTestDays"] == 47
    assert r["marginToPslBar"] == 0.1
    assert r["sopIntervalDays"] == 30


def test_autostart_good_when_recent():
    r = autostart.check(1.6, [{"testDate": "2026-10-10", "result": "pass"}], "2026-10-18")
    assert r["verdict"] == "G" and r["lastTestDays"] == 8


def test_oil_limits_water():
    assert oil_limits.check_water(140)["verdict"] == "G"
    assert oil_limits.check_water(700)["verdict"] == "NG"  # above site action 500 ppm
    assert "1,000 ppm" in oil_limits.check_water(1800)["label"]
    hero_lab = data.oil_lab()[0]
    assert oil_limits.check_oil(hero_lab)["verdict"] == "G"
    assert oil_limits.check_oil({"waterPpm": 1800, "iso4406": "20/18/15"})["verdict"] == "NG"


def test_iso4406_lookup():
    assert oil_limits.iso4406_code_for_count(2000) == 18
    assert oil_limits.iso4406_code(2000, 500, 60) == "18/16/13"
    assert oil_limits.check_iso4406("17/15/12")["verdict"] == "G"
    assert oil_limits.check_iso4406("19/16/13")["verdict"] == "NG"


def test_bearing_temperature():
    assert bearings.check(94, 1.2)["verdict"] == "G"
    assert bearings.check(118)["verdict"] == "NG"
    assert bearings.check(126)["verdict"] == "NG"
    assert bearings.oxidation_factor(70) == 2.0


def test_pump_motor_rules():
    assert pump_motor.vibration_zone(1.8) == "A"
    assert pump_motor.vibration_zone(3.0) == "B"
    assert pump_motor.vibration_zone(5.0) == "C"
    assert pump_motor.vibration_zone(7.0) == "D"
    assert pump_motor.check_current(62, 70, 1.15)["verdict"] == "G"
    assert pump_motor.check_current(85, 70, 1.15)["verdict"] == "NG"
    assert pump_motor.voltage_unbalance(400, 400, 400)["verdict"] == "G"
    assert pump_motor.voltage_unbalance(410, 400, 385)["verdict"] == "NG"
    assert pump_motor.overheating_cause("up", "up", "flat")["cause"] == "mechanical_drag"
    h = pump_motor.pump_health(1.8, 62, 70, 1.15)
    assert h["verdict"] == "G" and "zone A" in h["label"]


def test_loss_exposure_matches_fixture():
    r = loss.exposure(data.incidents())
    assert r["exposureUsd"] == 2139912
    assert set(r["incidentIds"]) == {"INC-2022-031", "INC-2023-008", "INC-2021-044"}


def test_verification_passes_on_verified_fixture():
    fx = data.load_fixture("case_C0412_verified")
    r = verify.check(fx["readings"]["series"], fx["readings"]["postRepairFrom"])
    assert r["status"] == "verified_effective"
    assert r == fx["verification"]


def test_verification_reopens_before_repair():
    fx = data.load_fixture("case_C0412_open")
    r = verify.check(fx["readings"]["series"], None)
    assert r["status"] == "reopened"


def test_sop_sections_parsed():
    ids = data.sop_section_ids()
    for sid in ("SOP-LO-04 §2", "SOP-LO-02 §3.1", "SOP-LO-02 §3", "SOP-LO-05 §4", "SOP-LO-06 §3"):
        assert sid in ids
    assert "clear and bright" in data.sop_sections()["SOP-LO-04 §2"]["text"]
    assert data.normalize_citation("SOP-LO-04 section 2") == "SOP-LO-04 §2"
    assert data.normalize_citation("evidence:EV-1") == "EV-1"
