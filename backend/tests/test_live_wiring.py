"""Live code paths import and construct without calling the Gemini API."""
from app.agents import ask, investigator
from app.agents.common import build_client_unchecked
from app.agents.common import TraceWriter
from app.services import data
from app.services.store import get_store


def test_genai_client_constructs():
    client = build_client_unchecked("construct-only")
    assert hasattr(client, "models")


def test_adk_agent_constructs_with_tools(client=None):
    store = get_store()
    sid, _ = store.create_sandbox("u", "manager", "C-0412")
    case = data.load_fixture("case_C0412_seed")
    case["sandboxId"] = sid
    store.put_case(sid, case)
    ctx = investigator.InvestigationContext(sid, case, TraceWriter(sid, case["id"]))
    tools = investigator.build_tools(ctx)
    agent = investigator.build_adk_agent(tools)
    assert agent.name == "lubeguard_investigator"
    assert len(agent.tools) == 9
    # tools run locally and trace each call
    tools[1]()
    assert store.get_case(sid, "C-0412")["trace"][-1]["step"] == "classify_pressure_path"


def test_live_mode_without_key_falls_back(monkeypatch):
    from app import config

    monkeypatch.setenv("AI_MODE", "live")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    config.reload_settings()
    try:
        store = get_store()
        sid, _ = store.create_sandbox("u", "manager", "C-0412")
        case = data.load_fixture("case_C0412_seed")
        case["sandboxId"] = sid
        store.put_case(sid, case)
        out = investigator.investigate(sid, "C-0412")
        assert out["audit"]["cached"] is True
        assert out["diagnosis"]["matrix"]["material"]["verdict"] == "UNVERIFIED"
        resp, cached = ask.ask("Why is the filter loading?", out)
        assert not resp["refused"] and cached
    finally:
        monkeypatch.setenv("AI_MODE", "cached")
        config.reload_settings()
