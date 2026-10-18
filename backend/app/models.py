"""Contract models for Optiflow LubeGuard.

These Pydantic models are the source of truth for the data shapes in
`contracts/case.schema.json` and `fixtures/*.json`. The frontend relies on the
same field names, so change them only by agreement (see docs/DEV_PLAN.md).
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

Verdict = Literal["G", "NG", "UNVERIFIED"]
Provenance = Literal["ai", "human"]
TicketType = Literal["evidence_request", "corrective", "safety_test"]
TicketStatus = Literal["open", "in_progress", "on_hold", "done", "verified"]
Priority = Literal["high", "medium", "low"]
Role = Literal["manager", "engineer"]


class Asset(BaseModel):
    id: str
    name: str
    system: str


class TagSetpoint(BaseModel):
    unit: str
    low: Optional[float] = None
    lowLow: Optional[float] = None
    high: Optional[float] = None
    change: Optional[float] = None
    alarm: Optional[float] = None
    trip: Optional[float] = None


class Readings(BaseModel):
    interval: str = "1h"
    # tag -> list of [iso_timestamp, value]
    series: dict[str, list[tuple[str, float]]]
    setpoints: dict[str, TagSetpoint] = Field(default_factory=dict)
    postRepairFrom: Optional[str] = None


class TagDetection(BaseModel):
    tag: str
    anomalous: bool
    probability: float
    slopePerDay: float


class DriftCheck(BaseModel):
    verdict: Literal["physical", "instrument_suspect"]
    reason: str


class Detection(BaseModel):
    method: str
    tags: list[TagDetection]
    driftCheck: DriftCheck


class PressurePath(BaseModel):
    ruleId: str = "R-T5"
    mechanism: Literal[
        "filter_loading", "pump_or_relief_valve", "external_leak",
        "water_ingress", "hot_oil_or_cooler", "instrument_drift", "normal",
    ]
    label: str
    evidence: str


class Autostart(BaseModel):
    ruleId: str = "R-T4"
    marginToPslBar: float
    lastTestDays: int
    sopIntervalDays: int
    verdict: Verdict
    label: str


class Impact(BaseModel):
    lossPerMinUsd: float = 0.0
    exposureUsd: float
    formula: str
    assumptions: list[str]


class MatrixCell(BaseModel):
    verdict: Verdict
    evidence: str
    citations: list[str] = Field(default_factory=list)
    provenance: Provenance = "ai"


class Matrix(BaseModel):
    man: MatrixCell
    machine: MatrixCell
    method: MatrixCell
    material: MatrixCell
    environment: MatrixCell


class RootCause(BaseModel):
    text: str
    path: list[str]  # knowledge-graph node ids, upstream to downstream


class EvidenceRequest(BaseModel):
    category: Literal["man", "machine", "method", "material", "environment"]
    instruction: str
    sopRef: str
    ticketId: Optional[str] = None


class Diagnosis(BaseModel):
    matrix: Optional[Matrix] = None
    rootCause: Optional[RootCause] = None
    evidenceRequests: list[EvidenceRequest] = Field(default_factory=list)


class Judgement(BaseModel):
    verdict: Verdict
    finding: str
    reason: str
    confidence: float
    transcript: Optional[str] = None


class Evidence(BaseModel):
    id: str
    ticketId: str
    caseId: str
    kind: Literal["photo", "voice", "gauge"]
    storagePath: str
    uploadedAt: str
    note: Optional[str] = None
    judged: Optional[Judgement] = None
    by: str = "engineer"


class Action(BaseModel):
    id: str
    title: str
    category: Literal["man", "machine", "method", "material", "environment"]
    quadrant: Literal["quick_win", "major", "escalate", "deprioritize"]
    authority: Literal["shift", "plant", "ho"]
    timing: Literal["now", "next_shutdown"]
    sopCitations: list[str]
    steps: list[str]
    assigneeRole: Literal["engineer", "mechanical_shift_b", "manager"] = "engineer"
    ticketType: TicketType = "corrective"


class Decision(BaseModel):
    actions: list[Action] = Field(default_factory=list)
    approvedActionIds: list[str] = Field(default_factory=list)
    timingNote: Optional[str] = None


class VerificationCheck(BaseModel):
    tag: str
    baseline: float
    band: float
    last: float
    passed: bool


class Verification(BaseModel):
    status: Literal["pending", "verified_effective", "reopened"] = "pending"
    checks: list[VerificationCheck] = Field(default_factory=list)


class TraceEntry(BaseModel):
    at: str
    step: str
    summary: str
    provenance: Provenance = "ai"


class Audit(BaseModel):
    model: str = "gemini-3.8-flash"
    promptVersion: str = "v1"
    cached: bool = False


class Case(BaseModel):
    id: str
    sandboxId: str
    asset: Asset
    title: str
    status: Literal["open", "investigating", "awaiting_evidence", "action_proposed",
                    "actions_approved", "verified", "reopened"]
    openedAt: str
    syntheticDataNote: str
    readings: Readings
    detection: Optional[Detection] = None
    pressurePath: Optional[PressurePath] = None
    autostart: Optional[Autostart] = None
    impact: Optional[Impact] = None
    diagnosis: Diagnosis = Field(default_factory=Diagnosis)
    evidence: list[Evidence] = Field(default_factory=list)
    decision: Decision = Field(default_factory=Decision)
    ticketIds: list[str] = Field(default_factory=list)
    verification: Verification = Field(default_factory=Verification)
    trace: list[TraceEntry] = Field(default_factory=list)
    audit: Audit = Field(default_factory=Audit)


class ChecklistStep(BaseModel):
    id: str
    text: str
    sopRef: Optional[str] = None


class TicketReport(BaseModel):
    summary: str
    condition: Literal["good", "fair", "poor"]


class Ticket(BaseModel):
    id: str
    type: TicketType
    title: str
    caseId: str
    component: str
    priority: Priority
    dueAt: str
    estimateMin: int
    assigneeRole: Literal["engineer", "mechanical_shift_b", "manager"]
    assigneeName: str
    status: TicketStatus = "open"
    checklist: list[ChecklistStep] = Field(default_factory=list)
    evidenceRequest: Optional[EvidenceRequest] = None
    createdBy: Provenance = "ai"
    createdAt: str
    report: Optional[TicketReport] = None
    actionId: Optional[str] = None


class Notification(BaseModel):
    id: str
    toRole: Role
    event: Literal["case_opened", "evidence_requested", "evidence_received", "task_assigned",
                   "task_completed", "task_overdue", "action_approved", "verification_result"]
    title: str
    body: str
    ref: dict[str, str] = Field(default_factory=dict)
    read: bool = False
    at: str


class KgNode(BaseModel):
    id: str
    type: Literal["system", "component", "tag", "failure_mode", "rule", "sop", "incident", "case"]
    label: str
    props: dict = Field(default_factory=dict)


class KgEdge(BaseModel):
    source: str
    target: str
    type: str


class KgGraph(BaseModel):
    nodes: list[KgNode]
    edges: list[KgEdge]
    highlight: list[str] = Field(default_factory=list)


class Citation(BaseModel):
    id: str
    type: str
    label: str


class AskResponse(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    refused: bool = False


# ---- request bodies ----

class SessionRequest(BaseModel):
    role: Role = "manager"


class SessionResponse(BaseModel):
    sandboxId: str
    code: str
    caseId: str
    role: Role = "manager"


class JoinRequest(BaseModel):
    code: str


class SandboxRequest(BaseModel):
    sandboxId: str


class EvidenceRequestBody(BaseModel):
    sandboxId: str
    category: Literal["man", "machine", "method", "material", "environment"] = "material"


class EvidenceUpload(BaseModel):
    sandboxId: str
    ticketId: str
    caseId: str
    kind: Literal["photo", "voice", "gauge"]
    storagePath: str
    note: Optional[str] = None
    sample: Optional[Literal["hazy_oil", "clear_oil", "voice_hazy"]] = None


class ApproveRequest(BaseModel):
    sandboxId: str
    actionIds: list[str]


class CompleteRequest(BaseModel):
    sandboxId: str
    report: TicketReport


class AskRequest(BaseModel):
    sandboxId: str
    question: str
    caseId: Optional[str] = None
