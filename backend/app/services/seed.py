"""Seed a sandbox with case C-0412 (pre-investigation state) and its opening notification."""
from __future__ import annotations

from ..config import PROMPT_VERSION, get_settings
from ..models import Case
from . import data
from .notify import notify
from .store import get_store

CASE_ID = "C-0412"


def seed_case(sid: str) -> dict:
    case = data.load_fixture("case_C0412_seed")
    case["sandboxId"] = sid
    case["audit"] = {"model": get_settings().gemini_model, "promptVersion": PROMPT_VERSION, "cached": False}
    case = Case.model_validate(case).model_dump(mode="json")
    get_store().put_case(sid, case)
    notify(sid, "manager", "case_opened", f"New case {case['id']}", "Lube-oil header pressure decay on ST-01",
           {"caseId": case["id"]})
    return case
