"""Knowledge graph route."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends

from ..models import KgGraph
from ..services import data
from ..services.auth import current_uid, require_member
from ..services.store import get_store

router = APIRouter(tags=["kg"])


def sandbox_graph(sbx: dict, case: Optional[dict]) -> dict:
    g = data.kg()
    extra = sbx.get("kgExtra") or {}
    g["nodes"] = g["nodes"] + extra.get("nodes", [])
    g["edges"] = g["edges"] + extra.get("edges", [])
    highlight: list[str] = []
    if case:
        root = (case.get("diagnosis") or {}).get("rootCause") or {}
        highlight = list(root.get("path") or [])
        affects = highlight or (["F-101A", "HEADER"] if case.get("pressurePath") else [])
        g["nodes"].append({"id": case["id"], "type": "case", "label": f"{case['id']} {case['title']}",
                           "props": {"status": case.get("status")}})
        g["edges"] += [{"source": case["id"], "target": a, "type": "AFFECTS"} for a in affects]
    g["highlight"] = highlight
    return g


@router.get("/kg")
def get_kg(sandboxId: str, caseId: Optional[str] = None, uid: str = Depends(current_uid)) -> dict:
    sbx = require_member(sandboxId, uid)
    case = get_store().get_case(sandboxId, caseId) if caseId else None
    return KgGraph.model_validate(sandbox_graph(sbx, case)).model_dump(mode="json")
