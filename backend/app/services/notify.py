"""Notification helper (sandboxes/{sid}/notifications/{nid})."""
from __future__ import annotations

from typing import Optional

from .data import now_iso
from .store import get_store


def notify(sid: str, to_role: str, event: str, title: str, body: str, ref: Optional[dict] = None) -> dict:
    store = get_store()
    role = to_role if to_role in ("manager", "engineer") else "manager"
    n = {"id": store.next_notification_id(sid), "toRole": role, "event": event, "title": title,
         "body": body, "ref": {k: str(v) for k, v in (ref or {}).items() if v is not None},
         "read": False, "at": now_iso()}
    store.add_notification(sid, n)
    return n
