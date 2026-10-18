// In-browser stand-in for the backend, used when VITE_USE_FIXTURES=true.
// It walks case C-0412 through the fixture states (seed -> open -> evidence -> verified)
// when the Incident Room and Engineer buttons are pressed, so the whole UI is demoable
// without a backend. State lives in localStorage so a Manager tab and an Engineer tab
// in the same browser stay in sync.

const STATE_KEY = 'optiflow.fixtureState';
const STAGE_FILE = {
  seed: 'case_C0412_seed',
  investigating: 'case_C0412_open',
  open: 'case_C0412_open',
  evidence: 'case_C0412_evidence',
  verified: 'case_C0412_verified',
};
const SANDBOX = { sandboxId: 'sbx_fixture', code: '7KQ2PX', caseId: 'C-0412' };

const cache = new Map();
const listeners = new Set();

export async function loadFixture(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(`/fixtures/${name}.json`).then((r) => {
        if (!r.ok) throw new Error(`Fixture ${name} not found (run npm run dev, which copies fixtures)`);
        return r.json();
      }),
    );
  }
  try {
    return await cache.get(name);
  } catch (err) {
    cache.delete(name);
    throw err;
  }
}

const nowIso = () => new Date().toISOString();

// Fixture tickets carry fixed timestamps; shift them so "due" stays relative to now.
function rebase(t) {
  const created = Date.parse(t.createdAt);
  const due = Date.parse(t.dueAt);
  const offset = Number.isNaN(created) || Number.isNaN(due) ? 30 * 60000 : Math.max(due - created, 15 * 60000);
  return { ...t, createdAt: nowIso(), dueAt: new Date(Date.now() + offset).toISOString() };
}
const clone = (o) => JSON.parse(JSON.stringify(o));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function initialState() {
  return {
    stage: 'seed',
    traceShown: 1,
    evidenceRequested: false,
    approved: [],
    tickets: [],
    notifications: [
      {
        id: 'N-1',
        toRole: 'manager',
        event: 'case_opened',
        title: 'New case C-0412',
        body: 'Lube-oil header pressure decay on ST-01',
        ref: { caseId: 'C-0412' },
        read: false,
        at: nowIso(),
      },
    ],
    progress: {},
    extraEvidence: [],
    materialOverride: null,
    humanTrace: [],
    seq: 1,
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) return { ...initialState(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return initialState();
}

function commit(next) {
  state = next;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn());
}

function update(mutator) {
  const next = clone(state);
  mutator(next);
  commit(next);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STATE_KEY) {
      state = load();
      listeners.forEach((fn) => fn());
    }
  });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function nextId(s, prefix) {
  s.seq += 1;
  return `${prefix}-${s.seq}`;
}

function notify(s, toRole, event, title, body, ref) {
  s.notifications.unshift({ id: nextId(s, 'N'), toRole, event, title, body, ref, read: false, at: nowIso() });
}

// ---------- derived reads ----------

export async function getCase() {
  const s = state;
  const base = clone(await loadFixture(STAGE_FILE[s.stage]));
  const c = base;
  if (s.stage === 'investigating') {
    c.status = 'investigating';
    c.trace = c.trace.slice(0, s.traceShown);
    const steps = new Set(c.trace.map((t) => t.step));
    if (!steps.has('classify_pressure_path')) c.pressurePath = null;
    if (!steps.has('check_autostart_readiness')) c.autostart = null;
    if (!steps.has('structure_matrix')) c.diagnosis.matrix = null;
    if (!steps.has('evidence_request')) c.diagnosis.evidenceRequests = [];
  }
  if (s.stage === 'open' && s.evidenceRequested) {
    if (c.diagnosis.evidenceRequests[0]) c.diagnosis.evidenceRequests[0].ticketId = 'T-1';
  }
  if (s.stage === 'evidence' && s.approved.length) {
    c.decision.approvedActionIds = s.approved;
    c.status = 'actions_approved';
  }
  if (s.stage !== 'verified') {
    c.ticketIds = s.tickets.map((t) => t.id);
    c.trace = [...c.trace, ...s.humanTrace.filter((t) => t.stage === s.stage).map(({ stage, ...t }) => t)];
  }
  if (s.extraEvidence.length) c.evidence = [...c.evidence, ...s.extraEvidence];
  if (s.materialOverride && c.diagnosis.matrix && s.stage === 'open') c.diagnosis.matrix.material = s.materialOverride;
  c.audit = { ...c.audit, cached: true };
  return c;
}

export function getStage() {
  return state.stage;
}

// ---------- API stand-ins (same names and shapes as lib/api.js) ----------

export async function createSession(role = 'manager') {
  await sleep(250);
  return { ...SANDBOX, role };
}

export async function joinSandbox(code) {
  await sleep(250);
  if (!code || String(code).trim().length < 4) throw new Error('Enter the 6-character join code');
  return { ...SANDBOX, role: 'engineer' };
}

export async function resetDemo() {
  commit(initialState());
  return { ok: true };
}

export async function investigate() {
  if (state.stage !== 'seed') return getCase();
  const open = await loadFixture(STAGE_FILE.open);
  update((s) => {
    s.stage = 'investigating';
    s.traceShown = 1;
  });
  for (let i = 2; i <= open.trace.length; i++) {
    await sleep(650);
    update((s) => {
      s.traceShown = i;
    });
  }
  update((s) => {
    s.stage = 'open';
  });
  return getCase();
}

export async function requestEvidence(caseId, sandboxId, category = 'material') {
  await sleep(400);
  const fixtureTickets = await loadFixture('tickets');
  let ticket;
  update((s) => {
    if (category === 'material') {
      const existing = s.tickets.find((t) => t.id === 'T-1');
      if (existing) {
        ticket = existing;
        return;
      }
      ticket = { ...rebase(clone(fixtureTickets.find((t) => t.id === 'T-1'))), status: 'open', report: null };
      s.evidenceRequested = true;
      s.humanTrace.push({
        stage: 'open',
        at: nowIso(),
        step: 'evidence_request_sent',
        summary: 'Dimas sent the oil sample request to Joko (T-1)',
        provenance: 'human',
      });
    } else {
      ticket = {
        id: nextId(s, 'T'),
        type: 'evidence_request',
        title: 'Check cooling-water side of cooler E-101A',
        caseId: 'C-0412',
        component: 'E-101A',
        priority: 'medium',
        dueAt: new Date(Date.now() + 60 * 60000).toISOString(),
        estimateMin: 20,
        assigneeRole: 'engineer',
        assigneeName: 'Joko, Field Engineer',
        status: 'open',
        checklist: [
          { id: 's1', text: 'Read oil-side and water-side pressure at E-101A', sopRef: 'SOP-LO-03 §3' },
          { id: 's2', text: 'Photograph both gauges', sopRef: 'SOP-LO-03 §3' },
        ],
        evidenceRequest: { category, instruction: 'Compare oil and cooling-water pressure at E-101A.', sopRef: 'SOP-LO-03 §3', ticketId: null },
        createdBy: 'human',
        createdAt: nowIso(),
        report: null,
      };
      ticket.evidenceRequest.ticketId = ticket.id;
    }
    if (!s.tickets.find((t) => t.id === ticket.id)) s.tickets.push(ticket);
    notify(s, 'engineer', 'evidence_requested', 'Evidence requested', `${ticket.title} (${ticket.checklist[0]?.sopRef || ''})`, {
      caseId: 'C-0412',
      ticketId: ticket.id,
    });
  });
  return ticket;
}

export async function postEvidence(body) {
  await sleep(1200);
  const evFixture = await loadFixture(STAGE_FILE.evidence);
  let result;
  update((s) => {
    if (body.sample === 'clear_oil') {
      const id = nextId(s, 'EV');
      result = {
        id,
        ticketId: body.ticketId,
        caseId: body.caseId,
        kind: 'photo',
        storagePath: body.storagePath || 'samples/clear_oil.jpg',
        uploadedAt: nowIso(),
        note: body.note || null,
        judged: {
          verdict: 'G',
          finding: 'Oil is clear and bright; no free water visible',
          reason: 'Clear and bright appearance passes the visual check (SOP-LO-04 §2)',
          confidence: 0.85,
          transcript: null,
        },
        by: 'engineer',
      };
      s.extraEvidence.push(result);
      if (s.stage === 'open' || s.stage === 'investigating') {
        s.materialOverride = {
          verdict: 'G',
          evidence: 'Engineer photo: oil clear and bright, no free water visible',
          citations: ['R-T1', id, 'SOP-LO-04 §2'],
          provenance: 'human',
        };
      }
      notify(s, 'manager', 'evidence_received', 'Evidence received', 'Oil photo judged G: clear and bright', {
        caseId: 'C-0412',
        ticketId: body.ticketId,
      });
      return;
    }
    const template = evFixture.evidence.find((e) => e.kind === (body.kind === 'voice' ? 'voice' : 'photo'));
    result = { ...clone(template), ticketId: body.ticketId, uploadedAt: nowIso(), note: body.note || null };
    if (s.stage === 'open' || s.stage === 'investigating' || s.stage === 'seed') {
      s.stage = 'evidence';
      s.materialOverride = null;
      notify(s, 'manager', 'evidence_received', 'Evidence received', 'Oil photo judged NG: free water suspected', {
        caseId: 'C-0412',
        ticketId: body.ticketId,
      });
    }
  });
  return result;
}

export async function approve(caseId, sandboxId, actionIds) {
  await sleep(600);
  const fixtureTickets = await loadFixture('tickets');
  const evCase = await loadFixture(STAGE_FILE.evidence);
  const created = [];
  update((s) => {
    s.approved = Array.from(new Set([...s.approved, ...actionIds]));
    for (const aid of actionIds) {
      if (s.tickets.find((t) => t.actionId === aid)) continue;
      const fx = fixtureTickets.find((t) => t.actionId === aid);
      const action = evCase.decision.actions.find((a) => a.id === aid);
      let t;
      if (fx) t = { ...rebase(clone(fx)), status: 'open', report: null };
      else if (action) {
        t = {
          id: nextId(s, 'T'),
          type: action.ticketType,
          title: action.title,
          caseId: 'C-0412',
          component: action.category === 'material' ? 'OIL' : 'E-101A',
          priority: action.timing === 'now' ? 'high' : 'low',
          dueAt: new Date(Date.now() + (action.timing === 'now' ? 2 : 24 * 14) * 3600000).toISOString(),
          estimateMin: 60,
          assigneeRole: action.assigneeRole,
          assigneeName: action.assigneeRole === 'engineer' ? 'Joko, Field Engineer' : 'Mechanical Shift B',
          status: 'open',
          checklist: action.steps.map((text, i) => ({ id: `s${i + 1}`, text, sopRef: action.sopCitations[i] || action.sopCitations[0] })),
          evidenceRequest: null,
          createdBy: 'ai',
          createdAt: nowIso(),
          report: null,
          actionId: aid,
        };
      }
      if (!t) continue;
      s.tickets.push(t);
      created.push(t);
      notify(s, t.assigneeRole === 'engineer' ? 'engineer' : 'manager', 'task_assigned', 'New task', t.title, {
        caseId: 'C-0412',
        ticketId: t.id,
      });
    }
    s.humanTrace.push({
      stage: 'evidence',
      at: nowIso(),
      step: 'approve',
      summary: `Dimas approved ${actionIds.join(', ')}`,
      provenance: 'human',
    });
    notify(s, 'manager', 'action_approved', 'Actions approved', `${actionIds.join(', ')} approved; ${created.length} tickets created`, {
      caseId: 'C-0412',
    });
  });
  return { tickets: created };
}

export async function verify() {
  await sleep(1500);
  update((s) => {
    s.stage = 'verified';
    s.tickets = s.tickets.map((t) => (t.status === 'done' ? { ...t, status: 'verified' } : t));
    notify(s, 'manager', 'verification_result', 'Verified effective', 'PT-104, PDT-101 and TE-201 back within baseline bands', {
      caseId: 'C-0412',
    });
  });
  return getCase();
}

export async function getTickets(sandboxId, role) {
  const list = state.tickets;
  return clone(role === 'engineer' ? list.filter((t) => t.assigneeRole === 'engineer') : list);
}

export async function createTicket(body) {
  await sleep(300);
  let t;
  update((s) => {
    const { sandboxId, ...rest } = body;
    t = { status: 'open', checklist: [], evidenceRequest: null, report: null, ...rest, id: nextId(s, 'T'), createdBy: 'human', createdAt: nowIso() };
    s.tickets.push(t);
    if (t.assigneeRole === 'engineer') notify(s, 'engineer', 'task_assigned', 'New task', t.title, { caseId: t.caseId, ticketId: t.id });
  });
  return t;
}

export async function patchTicket(ticketId, body) {
  await sleep(200);
  let t;
  update((s) => {
    const idx = s.tickets.findIndex((x) => x.id === ticketId);
    if (idx < 0) return;
    const prev = s.tickets[idx];
    const { sandboxId, ...changes } = body;
    t = { ...prev, ...Object.fromEntries(Object.entries(changes).filter(([, v]) => v != null)) };
    s.tickets[idx] = t;
    if (changes.assigneeRole && changes.assigneeRole !== prev.assigneeRole) {
      notify(s, changes.assigneeRole === 'engineer' ? 'engineer' : 'manager', 'task_assigned', 'Task reassigned', t.title, {
        caseId: t.caseId,
        ticketId: t.id,
      });
    }
  });
  if (!t) throw new Error(`Ticket ${ticketId} not found`);
  return t;
}

export async function getProgress(ticketId) {
  return clone(Object.values(state.progress[ticketId] || {}));
}

export async function putProgress(ticketId, stepId, body) {
  const p = { stepId, done: body.done ?? true, result: body.result ?? null, note: body.note ?? null, reading: body.reading ?? null, by: 'engineer', at: nowIso() };
  update((s) => {
    s.progress[ticketId] = { ...(s.progress[ticketId] || {}), [stepId]: p };
    const t = s.tickets.find((x) => x.id === ticketId);
    if (t && t.status === 'open') t.status = 'in_progress';
  });
  return p;
}

export async function completeTicket(ticketId, sandboxId, report) {
  await sleep(400);
  let t;
  update((s) => {
    t = s.tickets.find((x) => x.id === ticketId);
    if (!t) return;
    t.status = 'done';
    t.report = report;
    notify(s, 'manager', 'task_completed', 'Task completed', `${t.title}: ${report.summary}`, { caseId: t.caseId, ticketId });
  });
  if (!t) throw new Error(`Ticket ${ticketId} not found`);
  return clone(t);
}

export async function getKg() {
  const kg = clone(await loadFixture('kg'));
  if (!['evidence', 'verified'].includes(state.stage)) kg.highlight = [];
  return kg;
}

const STOP = new Set(
  'what does the say about why is are how when which who this that with from for and was were will can into does did have has its it of on in to a an be by at or as me my our your'.split(' '),
);

export async function ask(sandboxId, question) {
  await sleep(700);
  const examples = await loadFixture('ask_examples');
  const norm = (q) => q.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();
  const hit = examples.find((e) => norm(e.question) === norm(question));
  if (hit) return clone(hit.response);

  // Fixture-mode retrieval: keyword match over the knowledge-graph nodes only.
  const kg = await loadFixture('kg');
  const terms = norm(question)
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  const scored = kg.nodes
    .map((n) => {
      const hay = `${n.id} ${n.label} ${n.props?.description || ''}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (hay.includes(t) ? 1 : 0), 0);
      return { n, score };
    })
    .filter((x) => x.score >= Math.min(2, terms.length) && x.n.type !== 'system')
    .sort((a, b) => b.score - a.score || (a.n.type === 'sop' ? -1 : 1))
    .slice(0, 5);
  if (!scored.length) {
    return { answer: '0 sources, answer refused. I only answer from this plant\'s lube-oil knowledge graph and SOPs.', citations: [], refused: true };
  }
  const lines = scored.map(({ n }) => n.label + (n.props?.description ? `: ${n.props.description}` : ''));
  return {
    answer: `From the plant knowledge graph (fixture mode keyword retrieval): ${lines.join('; ')}.`,
    citations: scored.map(({ n }) => ({ id: n.id, type: n.type, label: n.label })),
    refused: false,
  };
}

export async function getNotifications(sandboxId, role) {
  return clone(role ? state.notifications.filter((n) => n.toRole === role) : state.notifications);
}

export async function markNotificationRead(id) {
  update((s) => {
    const n = s.notifications.find((x) => x.id === id);
    if (n) n.read = true;
  });
  return { ok: true };
}

export async function health() {
  return { ok: true, version: 'fixtures', aiMode: 'cached', store: 'browser' };
}
