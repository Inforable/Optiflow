"""Environment settings for the LubeGuard backend.

Modes:
- AI_MODE: live (Gemini calls) or cached (fixture states, no Gemini). Defaults to
  cached when GEMINI_API_KEY is empty.
- STORE: firestore or memory. Defaults to memory when GOOGLE_CLOUD_PROJECT is empty.
- AUTH_MODE: firebase (verify ID tokens) or off (X-Dev-Uid header, local only).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache

VERSION = "0.1.0"
PROMPT_VERSION = "v1"


def _env(name: str, default: str = "") -> str:
    value = os.environ.get(name)
    return value.strip() if value is not None and value.strip() != "" else default


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    gemini_model: str
    ai_mode: str
    store: str
    auth_mode: str
    google_cloud_project: str
    bq_dataset: str
    storage_bucket: str
    live_timeout_s: float
    replay_delay_scale: float

    @property
    def live(self) -> bool:
        return self.ai_mode == "live"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    key = _env("GEMINI_API_KEY")
    project = _env("GOOGLE_CLOUD_PROJECT") or _env("GCLOUD_PROJECT")
    ai_mode = _env("AI_MODE", "live" if key else "cached").lower()
    if ai_mode not in ("live", "cached"):
        ai_mode = "cached"
    store = _env("STORE", "firestore" if project else "memory").lower()
    if store not in ("firestore", "memory"):
        store = "memory"
    auth_mode = _env("AUTH_MODE", "firebase" if store == "firestore" else "off").lower()
    if auth_mode not in ("firebase", "off"):
        auth_mode = "firebase"
    try:
        timeout = float(_env("LIVE_TIMEOUT_S", "25"))
    except ValueError:
        timeout = 25.0
    try:
        # Multiplier for the cached trace replay pauses (tests set 0)
        scale = float(_env("REPLAY_DELAY_SCALE", "1"))
    except ValueError:
        scale = 1.0
    return Settings(
        gemini_api_key=key,
        gemini_model=_env("GEMINI_MODEL", "gemini-3.8-flash"),
        ai_mode=ai_mode,
        store=store,
        auth_mode=auth_mode,
        google_cloud_project=project,
        bq_dataset=_env("BQ_DATASET", "lube"),
        storage_bucket=_env("STORAGE_BUCKET"),
        live_timeout_s=timeout,
        replay_delay_scale=scale,
    )


def reload_settings() -> Settings:
    get_settings.cache_clear()
    return get_settings()
