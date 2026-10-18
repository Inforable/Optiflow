"""Evidence media bytes: inline base64, Cloud Storage, or bundled samples."""
from __future__ import annotations

import base64
import logging
import mimetypes
import os
from typing import Optional

from ..config import get_settings
from .data import SAMPLES_DIR

log = logging.getLogger("lubeguard.storage")

SAMPLE_FILES = {
    "hazy_oil": ("hazy_oil", "image/jpeg"),
    "clear_oil": ("clear_oil", "image/jpeg"),
    "voice_hazy": ("voice_hazy", "audio/webm"),
}


def sample_path(sample: str) -> Optional[tuple[str, str]]:
    """Return (path, mime) of a bundled sample file if present in backend/data/samples."""
    if not os.path.isdir(SAMPLES_DIR):
        return None
    stem = SAMPLE_FILES.get(sample, (sample, None))[0]
    for fn in os.listdir(SAMPLES_DIR):
        if os.path.splitext(fn)[0] == stem:
            path = os.path.join(SAMPLES_DIR, fn)
            mime = mimetypes.guess_type(fn)[0] or SAMPLE_FILES.get(sample, ("", "application/octet-stream"))[1]
            return path, mime
    return None


def fetch_bytes(storage_path: str = "", data_b64: Optional[str] = None, mime_type: Optional[str] = None,
                sample: Optional[str] = None) -> Optional[tuple[bytes, str]]:
    """Return (bytes, mime) for the evidence or None when nothing is reachable."""
    if data_b64:
        raw = data_b64.split(",", 1)[1] if data_b64.startswith("data:") else data_b64
        try:
            return base64.b64decode(raw), mime_type or "application/octet-stream"
        except Exception as exc:
            log.warning("bad base64 evidence: %s", exc)
    if sample:
        found = sample_path(sample)
        if found:
            with open(found[0], "rb") as f:
                return f.read(), found[1]
    s = get_settings()
    if storage_path and s.storage_bucket and s.store == "firestore":
        try:
            from google.cloud import storage

            blob = storage.Client(project=s.google_cloud_project or None).bucket(s.storage_bucket).blob(storage_path)
            data = blob.download_as_bytes(timeout=15)
            mime = blob.content_type or mime_type or mimetypes.guess_type(storage_path)[0] or "application/octet-stream"
            return data, mime
        except Exception as exc:
            log.warning("storage download failed for %s: %s", storage_path, exc)
    if storage_path:
        # A storagePath like samples/hazy_oil.jpg maps to a bundled sample
        stem = os.path.splitext(os.path.basename(storage_path))[0]
        found = sample_path(stem)
        if found:
            with open(found[0], "rb") as f:
                return f.read(), found[1]
    return None
