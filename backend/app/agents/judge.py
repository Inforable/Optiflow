"""Evidence judge: Gemini judges an oil photo or a voice note against the turbine-oil checklist.

Checklist (NICHE_DECISION section 4, SOP-LO-04 §2, [NR-012]): clear and bright = G;
hazy or milky = NG (free water); dark = NG (oxidation); foam = NG; visible particles = NG.
Cached mode and samples use canned judgements (hazy_oil and voice_hazy match fixture EV-1 and
EV-2; clear_oil returns G).
"""
from __future__ import annotations

import logging
from typing import Optional

from ..config import get_settings
from ..models import Judgement
from ..services import data
from ..services.storage import fetch_bytes, sample_path
from .common import call_with_timeout, generate_structured, genai_client

log = logging.getLogger("lubeguard.judge")

CLEAR_JUDGEMENT = {
    "verdict": "G",
    "finding": "Oil is clear and bright: no haze, no free water",
    "reason": "Turbine oil in good condition is clear and bright (SOP-LO-04 §2)",
    "confidence": 0.9,
    "transcript": None,
}

PROMPT = """You are an oil-condition inspector for a steam turbine lube-oil system (synthetic demo plant).
Judge the engineer's evidence against this checklist (SOP-LO-04 §2):
- Clear and bright oil: verdict G.
- Hazy, cloudy or milky oil: verdict NG, finding 'free water suspected'.
- Dark oil: verdict NG, finding 'oxidation suspected'.
- Foam on the surface: verdict NG, finding 'foaming or air entrainment'.
- Visible particles or sediment: verdict NG, finding 'particle contamination'.
- If the media does not show oil in a clear container (or the audio is not about the oil), verdict UNVERIFIED.
For a voice note, write the transcript in the spoken language (Bahasa Indonesia is common) followed by an
English translation in parentheses, then judge what the speaker reports.
Return verdict, a short finding, a reason that cites SOP-LO-04 §2, a confidence from 0 to 1, and the
transcript (voice only, otherwise null). Do not invent lab numbers."""


def _fixture_judgements() -> dict[str, dict]:
    ev = {e["id"]: e for e in data.load_fixture("case_C0412_evidence")["evidence"]}
    return {"hazy_oil": ev["EV-1"]["judged"], "voice_hazy": ev["EV-2"]["judged"], "clear_oil": dict(CLEAR_JUDGEMENT)}


def cached_judgement(kind: str, sample: Optional[str], storage_path: str = "", note: Optional[str] = None) -> dict:
    canned = _fixture_judgements()
    key = sample
    if not key:
        hint = f"{storage_path} {note or ''}".lower()
        if "clear" in hint:
            key = "clear_oil"
        elif kind == "voice":
            key = "voice_hazy"
        else:
            key = "hazy_oil"  # unknown media in cached mode: the hazy judgement
    if kind == "voice" and key == "hazy_oil":
        key = "voice_hazy"
    return dict(canned.get(key, canned["hazy_oil"]))


def _judge_live(media: bytes, mime: str, kind: str, note: Optional[str]) -> dict:
    from google.genai import types

    parts = [types.Part.from_bytes(data=media, mime_type=mime),
             types.Part.from_text(text=PROMPT + (f"\nEngineer note: {note}" if note else "")
                                  + f"\nEvidence kind: {kind}.")]
    j = generate_structured([types.Content(role="user", parts=parts)], Judgement)
    out = j.model_dump(mode="json")
    if kind != "voice":
        out["transcript"] = None
    out["confidence"] = max(0.0, min(1.0, float(out.get("confidence") or 0.0)))
    return out


def judge(kind: str, storage_path: str = "", sample: Optional[str] = None, data_b64: Optional[str] = None,
          mime_type: Optional[str] = None, note: Optional[str] = None) -> tuple[dict, bool]:
    """Return (judgement dict, cached flag)."""
    s = get_settings()
    use_live = s.live and (not sample or sample_path(sample) is not None)
    if use_live:
        try:
            genai_client()
            media = fetch_bytes(storage_path, data_b64, mime_type, sample)
            if media is None:
                raise RuntimeError("evidence media not reachable")
            out = call_with_timeout(_judge_live, media[0], media[1], kind, note, timeout=s.live_timeout_s)
            return out, False
        except Exception as exc:
            log.warning("live judgement failed, cached fallback: %s", exc)
    return cached_judgement(kind, sample, storage_path, note), True
