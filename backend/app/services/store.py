"""Operational store: one sandbox per demo session (paths per contracts/firestore.md).

MemoryStore (local development) and FirestoreStore (firebase-admin) behave the same.
Documents are plain JSON dicts; routes validate them with the contract models.
"""
from __future__ import annotations

import copy
import re
import secrets
import threading
from typing import Optional

from .data import now_iso

CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no 0, O, 1, I, L
SID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"
DEFAULT_NAMES = {"manager": "Dimas, Maintenance Supervisor", "engineer": "Joko, Field Engineer"}


def new_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))


def new_sid() -> str:
    return "sbx_" + "".join(secrets.choice(SID_ALPHABET) for _ in range(8))


def _num(id_: str) -> int:
    m = re.search(r"(\d+)$", id_ or "")
    return int(m.group(1)) if m else 0


class Store:
    """Interface. All methods are synchronous (routes run them in a threadpool)."""

    # sandboxes
    def create_sandbox(self, uid: str, role: str, case_id: str) -> tuple[str, str]: ...
    def get_sandbox(self, sid: str) -> Optional[dict]: ...
    def find_sandbox_by_code(self, code: str) -> Optional[str]: ...
    def add_member(self, sid: str, uid: str, role: str) -> None: ...
    def update_sandbox(self, sid: str, fields: dict) -> None: ...
    # cases
    def get_case(self, sid: str, case_id: str) -> Optional[dict]: ...
    def put_case(self, sid: str, case: dict) -> None: ...
    def append_trace(self, sid: str, case_id: str, entry: dict) -> None: ...
    # tickets
    def list_tickets(self, sid: str) -> list[dict]: ...
    def get_ticket(self, sid: str, ticket_id: str) -> Optional[dict]: ...
    def put_ticket(self, sid: str, ticket: dict) -> None: ...
    def put_progress(self, sid: str, ticket_id: str, step_id: str, progress: dict) -> None: ...
    def get_progress(self, sid: str, ticket_id: str) -> list[dict]: ...
    # evidence
    def put_evidence(self, sid: str, evidence: dict) -> None: ...
    def list_evidence(self, sid: str) -> list[dict]: ...
    # notifications
    def add_notification(self, sid: str, notification: dict) -> None: ...
    def list_notifications(self, sid: str, role: Optional[str] = None) -> list[dict]: ...
    def mark_read(self, sid: str, nid: str) -> bool: ...
    # lifecycle
    def reset_sandbox(self, sid: str) -> None: ...

    # helpers shared by both stores
    def next_ticket_id(self, sid: str) -> str:
        return f"T-{max([_num(t['id']) for t in self.list_tickets(sid)] + [0]) + 1}"

    def next_evidence_id(self, sid: str) -> str:
        return f"EV-{max([_num(e['id']) for e in self.list_evidence(sid)] + [0]) + 1}"

    def next_notification_id(self, sid: str) -> str:
        return f"N-{max([_nseq(n['id']) for n in self.list_notifications(sid)] + [0]) + 1}-{secrets.token_hex(2)}"

    def _sandbox_doc(self, uid: str, role: str, case_id: str, code: str) -> dict:
        return {"code": code, "createdAt": now_iso(), "caseId": case_id,
                "members": {uid: role}, "names": dict(DEFAULT_NAMES)}


def _sort_tickets(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda t: _num(t.get("id", "")))


def _nseq(nid: str) -> int:
    parts = (nid or "").split("-")
    return int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0


def _sort_by_at(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda n: (n.get("at", ""), _nseq(n.get("id", ""))))


class MemoryStore(Store):
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.sandboxes: dict[str, dict] = {}
        self.codes: dict[str, str] = {}
        self.cases: dict[str, dict[str, dict]] = {}
        self.tickets: dict[str, dict[str, dict]] = {}
        self.progress: dict[str, dict[str, dict[str, dict]]] = {}
        self.evidence: dict[str, dict[str, dict]] = {}
        self.notifications: dict[str, dict[str, dict]] = {}

    def create_sandbox(self, uid: str, role: str, case_id: str) -> tuple[str, str]:
        with self._lock:
            sid = new_sid()
            while sid in self.sandboxes:
                sid = new_sid()
            code = new_code()
            while code in self.codes:
                code = new_code()
            self.sandboxes[sid] = self._sandbox_doc(uid, role, case_id, code)
            self.codes[code] = sid
            return sid, code

    def get_sandbox(self, sid: str) -> Optional[dict]:
        with self._lock:
            return copy.deepcopy(self.sandboxes.get(sid))

    def find_sandbox_by_code(self, code: str) -> Optional[str]:
        with self._lock:
            return self.codes.get((code or "").strip().upper())

    def add_member(self, sid: str, uid: str, role: str) -> None:
        with self._lock:
            if sid in self.sandboxes:
                self.sandboxes[sid].setdefault("members", {})[uid] = role

    def update_sandbox(self, sid: str, fields: dict) -> None:
        with self._lock:
            if sid in self.sandboxes:
                self.sandboxes[sid].update(copy.deepcopy(fields))

    def get_case(self, sid: str, case_id: str) -> Optional[dict]:
        with self._lock:
            return copy.deepcopy(self.cases.get(sid, {}).get(case_id))

    def put_case(self, sid: str, case: dict) -> None:
        with self._lock:
            self.cases.setdefault(sid, {})[case["id"]] = copy.deepcopy(case)

    def append_trace(self, sid: str, case_id: str, entry: dict) -> None:
        with self._lock:
            case = self.cases.get(sid, {}).get(case_id)
            if case is not None and entry not in case.setdefault("trace", []):
                case["trace"].append(copy.deepcopy(entry))

    def list_tickets(self, sid: str) -> list[dict]:
        with self._lock:
            return _sort_tickets(copy.deepcopy(list(self.tickets.get(sid, {}).values())))

    def get_ticket(self, sid: str, ticket_id: str) -> Optional[dict]:
        with self._lock:
            return copy.deepcopy(self.tickets.get(sid, {}).get(ticket_id))

    def put_ticket(self, sid: str, ticket: dict) -> None:
        with self._lock:
            self.tickets.setdefault(sid, {})[ticket["id"]] = copy.deepcopy(ticket)

    def put_progress(self, sid: str, ticket_id: str, step_id: str, progress: dict) -> None:
        with self._lock:
            doc = {k: v for k, v in progress.items() if k != "stepId"}
            self.progress.setdefault(sid, {}).setdefault(ticket_id, {})[step_id] = copy.deepcopy(doc)

    def get_progress(self, sid: str, ticket_id: str) -> list[dict]:
        with self._lock:
            docs = self.progress.get(sid, {}).get(ticket_id, {})
            return [dict(copy.deepcopy(v), stepId=k) for k, v in sorted(docs.items())]

    def put_evidence(self, sid: str, evidence: dict) -> None:
        with self._lock:
            self.evidence.setdefault(sid, {})[evidence["id"]] = copy.deepcopy(evidence)

    def list_evidence(self, sid: str) -> list[dict]:
        with self._lock:
            return sorted(copy.deepcopy(list(self.evidence.get(sid, {}).values())), key=lambda e: _num(e["id"]))

    def add_notification(self, sid: str, notification: dict) -> None:
        with self._lock:
            self.notifications.setdefault(sid, {})[notification["id"]] = copy.deepcopy(notification)

    def list_notifications(self, sid: str, role: Optional[str] = None) -> list[dict]:
        with self._lock:
            items = copy.deepcopy(list(self.notifications.get(sid, {}).values()))
        if role:
            items = [n for n in items if n.get("toRole") == role]
        return _sort_by_at(items)

    def mark_read(self, sid: str, nid: str) -> bool:
        with self._lock:
            n = self.notifications.get(sid, {}).get(nid)
            if n is None:
                return False
            n["read"] = True
            return True

    def reset_sandbox(self, sid: str) -> None:
        with self._lock:
            for coll in (self.cases, self.tickets, self.progress, self.evidence, self.notifications):
                coll.pop(sid, None)
            if sid in self.sandboxes:
                self.sandboxes[sid].pop("kgExtra", None)


class FirestoreStore(Store):
    """firebase-admin Firestore implementation (Admin SDK bypasses security rules)."""

    def __init__(self, project: str = "", bucket: str = "") -> None:
        import firebase_admin
        from firebase_admin import firestore

        if not firebase_admin._apps:
            options = {}
            if project:
                options["projectId"] = project
            if bucket:
                options["storageBucket"] = bucket
            firebase_admin.initialize_app(options=options or None)
        self._fs = firestore
        self.db = firestore.client()

    def _sbx(self, sid: str):
        return self.db.collection("sandboxes").document(sid)

    def create_sandbox(self, uid: str, role: str, case_id: str) -> tuple[str, str]:
        sid = new_sid()
        while self._sbx(sid).get().exists:
            sid = new_sid()
        code = new_code()
        while self.db.collection("codes").document(code).get().exists:
            code = new_code()
        self._sbx(sid).set(self._sandbox_doc(uid, role, case_id, code))
        self.db.collection("codes").document(code).set({"sandboxId": sid})
        return sid, code

    def get_sandbox(self, sid: str) -> Optional[dict]:
        snap = self._sbx(sid).get()
        return snap.to_dict() if snap.exists else None

    def find_sandbox_by_code(self, code: str) -> Optional[str]:
        snap = self.db.collection("codes").document((code or "").strip().upper()).get()
        return (snap.to_dict() or {}).get("sandboxId") if snap.exists else None

    def add_member(self, sid: str, uid: str, role: str) -> None:
        self._sbx(sid).update({f"members.`{uid}`": role})

    def update_sandbox(self, sid: str, fields: dict) -> None:
        self._sbx(sid).set(fields, merge=True)

    def get_case(self, sid: str, case_id: str) -> Optional[dict]:
        snap = self._sbx(sid).collection("cases").document(case_id).get()
        return snap.to_dict() if snap.exists else None

    def put_case(self, sid: str, case: dict) -> None:
        self._sbx(sid).collection("cases").document(case["id"]).set(case)

    def append_trace(self, sid: str, case_id: str, entry: dict) -> None:
        self._sbx(sid).collection("cases").document(case_id).update({"trace": self._fs.ArrayUnion([entry])})

    def list_tickets(self, sid: str) -> list[dict]:
        return _sort_tickets([d.to_dict() for d in self._sbx(sid).collection("tickets").stream()])

    def get_ticket(self, sid: str, ticket_id: str) -> Optional[dict]:
        snap = self._sbx(sid).collection("tickets").document(ticket_id).get()
        return snap.to_dict() if snap.exists else None

    def put_ticket(self, sid: str, ticket: dict) -> None:
        self._sbx(sid).collection("tickets").document(ticket["id"]).set(ticket)

    def put_progress(self, sid: str, ticket_id: str, step_id: str, progress: dict) -> None:
        doc = {k: v for k, v in progress.items() if k != "stepId"}
        self._sbx(sid).collection("tickets").document(ticket_id).collection("progress").document(step_id).set(doc)

    def get_progress(self, sid: str, ticket_id: str) -> list[dict]:
        docs = self._sbx(sid).collection("tickets").document(ticket_id).collection("progress").stream()
        return sorted([dict(d.to_dict(), stepId=d.id) for d in docs], key=lambda p: p["stepId"])

    def put_evidence(self, sid: str, evidence: dict) -> None:
        self._sbx(sid).collection("evidence").document(evidence["id"]).set(evidence)

    def list_evidence(self, sid: str) -> list[dict]:
        return sorted([d.to_dict() for d in self._sbx(sid).collection("evidence").stream()], key=lambda e: _num(e["id"]))

    def add_notification(self, sid: str, notification: dict) -> None:
        self._sbx(sid).collection("notifications").document(notification["id"]).set(notification)

    def list_notifications(self, sid: str, role: Optional[str] = None) -> list[dict]:
        items = [d.to_dict() for d in self._sbx(sid).collection("notifications").stream()]
        if role:
            items = [n for n in items if n.get("toRole") == role]
        return _sort_by_at(items)

    def mark_read(self, sid: str, nid: str) -> bool:
        ref = self._sbx(sid).collection("notifications").document(nid)
        if not ref.get().exists:
            return False
        ref.update({"read": True})
        return True

    def _delete_collection(self, coll) -> None:
        for d in coll.stream():
            for sub in d.reference.collections():
                self._delete_collection(sub)
            d.reference.delete()

    def reset_sandbox(self, sid: str) -> None:
        for name in ("cases", "tickets", "evidence", "notifications"):
            self._delete_collection(self._sbx(sid).collection(name))
        self._sbx(sid).update({"kgExtra": self._fs.DELETE_FIELD})


_store: Optional[Store] = None
_store_lock = threading.Lock()


def get_store() -> Store:
    global _store
    if _store is None:
        with _store_lock:
            if _store is None:
                from ..config import get_settings

                s = get_settings()
                if s.store == "firestore":
                    _store = FirestoreStore(s.google_cloud_project, s.storage_bucket)
                else:
                    _store = MemoryStore()
    return _store


def set_store(store: Optional[Store]) -> None:
    global _store
    _store = store
