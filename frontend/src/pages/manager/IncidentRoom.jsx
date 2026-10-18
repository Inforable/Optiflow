// Incident Room (PRD MGR-02, section 13.1): severity header, trace, skid diagram, signal chart,
// diagnosis column (detection, pressure path, auto-start, exposure, 4M+1E matrix, evidence,
// actions, tickets, verification) and the Ask panel.
import { useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Activity, Play, Loader2, Workflow, LineChart, Grid3x3, Images, ListChecks, Ticket, MessageSquareText, Stethoscope, Database } from 'lucide-react';
import { useCase, useTickets, refreshNow } from '../../hooks/useData';
import * as api from '../../lib/api';
import { Card, Drawer, LiveDot, StatusPill, Skeleton, MicroLabel, EmptyState } from '../../components/ui';
import TraceTimeline from '../../components/manager/TraceTimeline';
import SkidDiagram from '../../components/manager/SkidDiagram';
import SignalChart from '../../components/manager/SignalChart';
import MatrixGrid from '../../components/manager/MatrixGrid';
import AskPanel from '../../components/manager/AskPanel';
import {
  DetectionBadge,
  PressurePathChip,
  AutostartCard,
  ExposureCard,
  EvidenceGallery,
  NextBestAction,
  ActionCards,
  LinkedTickets,
  VerificationPanel,
} from '../../components/manager/CasePanels';
import { COMPONENTS, TAG_INFO, componentStatus } from '../../lib/plant';
import { STATUS_LABEL, lastValue, fmtNum } from '../../lib/format';

const STATUS_TONE = {
  open: 'pill-red',
  investigating: 'pill-purple',
  awaiting_evidence: 'pill-amber',
  action_proposed: 'pill-cyan',
  actions_approved: 'pill-blue',
  verified: 'pill-green',
  reopened: 'pill-red',
};

function ComponentDrawer({ id, caseData, onClose }) {
  const info = id ? COMPONENTS[id] : null;
  const status = componentStatus(caseData)[id];
  const onPath = caseData?.diagnosis?.rootCause?.path?.includes(id);
  return (
    <Drawer open={Boolean(id)} onClose={onClose} title={id ? `${id}` : ''} subtitle={info?.name}>
      {info && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {status && status !== 'isolated' ? <StatusPill verdict={status} long size="lg" /> : <span className="pill pill-gray">{status === 'isolated' ? 'Isolated / standby' : 'No finding'}</span>}
            {onPath && <span className="pill pill-cyan">On root-cause path</span>}
          </div>
          {info.note && <p className="text-sm text-gray-300">{info.note}</p>}
          <div>
            <MicroLabel className="mb-2">Tags</MicroLabel>
            {info.tags.length ? (
              <ul className="space-y-1.5">
                {info.tags.map((t) => {
                  const v = lastValue(caseData?.readings?.series, t);
                  const det = caseData?.detection?.tags?.find((d) => d.tag === t);
                  return (
                    <li key={t} className="flex items-center justify-between rounded-control border border-dark-700 bg-dark-900 px-3 py-2">
                      <span>
                        <span className="font-mono text-xs font-bold text-white">{t}</span>
                        <span className="ml-2 text-xs text-gray-400">{TAG_INFO[t]?.label || ''}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {det?.anomalous && <span className="pill pill-amber">anomalous</span>}
                        <span className="font-mono text-sm text-accent-cyan">{v == null ? 'n/a' : `${fmtNum(v, TAG_INFO[t]?.digits ?? 2)} ${TAG_INFO[t]?.unit || ''}`}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">No live tags on this component.</p>
            )}
          </div>
          <div>
            <MicroLabel className="mb-2">Failure modes</MicroLabel>
            {info.failureModes.length ? (
              <div className="flex flex-wrap gap-1.5">
                {info.failureModes.map((f) => (
                  <span key={f} className="pill pill-red">
                    {f}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500">None modelled.</p>
            )}
          </div>
          <p className="text-[11px] text-gray-500">Synthetic demo plant. Values are SITE SETPOINTS (synthetic), not standards.</p>
        </div>
      )}
    </Drawer>
  );
}

export default function IncidentRoom() {
  const { caseId } = useParams();
  const { session } = useOutletContext();
  const navigate = useNavigate();
  const { data: c, loading, error } = useCase(caseId, session);
  const { data: tickets } = useTickets(session);
  const [running, setRunning] = useState(false);
  const [requesting, setRequesting] = useState(null);
  const [approving, setApproving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('diagnosis');

  const caseTickets = useMemo(() => (tickets || []).filter((t) => t.caseId === caseId), [tickets, caseId]);
  const onCite = (id) => navigate(`/m/graph?focus=${encodeURIComponent(id.replace(/^evidence:/, ''))}`);

  async function runInvestigation() {
    setRunning(true);
    const id = toast.loading('Investigator running: querying signals, rules and the graph...');
    try {
      await api.investigate(caseId, session.sandboxId);
      toast.success('Investigation complete: matrix ready', { id });
    } catch (err) {
      toast.error(`Investigation failed: ${err.message}`, { id });
    } finally {
      setRunning(false);
      refreshNow();
    }
  }

  async function sendRequest(category) {
    setRequesting(category);
    try {
      const t = await api.requestEvidence(caseId, session.sandboxId, category);
      toast.success(`Evidence request ${t?.id || ''} sent to ${t?.assigneeName || 'the engineer'}`);
    } catch (err) {
      toast.error(`Could not send the request: ${err.message}`);
    } finally {
      setRequesting(null);
      refreshNow();
    }
  }

  async function approveActions(ids) {
    setApproving(true);
    try {
      const res = await api.approve(caseId, session.sandboxId, ids);
      toast.success(`Approved ${ids.join(', ')}: ${res?.tickets?.length ?? 0} tickets created`);
    } catch (err) {
      toast.error(`Approval failed: ${err.message}`);
    } finally {
      setApproving(false);
      refreshNow();
    }
  }

  async function verifyFix() {
    setVerifying(true);
    const id = toast.loading('Replaying post-repair data and checking baselines...');
    try {
      const res = await api.verify(caseId, session.sandboxId);
      const ok = res?.verification?.status === 'verified_effective';
      if (ok) toast.success('Verified effective', { id });
      else toast.error('Not back to baseline: case reopened', { id });
    } catch (err) {
      toast.error(`Verification failed: ${err.message}`, { id });
    } finally {
      setVerifying(false);
      refreshNow();
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 xl:grid-cols-12">
          <Skeleton className="h-96 xl:col-span-3" />
          <Skeleton className="h-96 xl:col-span-5" />
          <Skeleton className="h-96 xl:col-span-4" />
        </div>
      </div>
    );
  }
  if (error && !c) return <EmptyState title="Could not load the case">{error.message}</EmptyState>;
  if (!c) return <EmptyState title={`Case ${caseId} not found`}>Reset the demo from the role menu.</EmptyState>;

  const isRunning = running || c.status === 'investigating';
  const verified = c.status === 'verified';
  const actions = c.decision?.actions || [];
  const nextAction = actions.find((a) => !c.decision.approvedActionIds?.includes(a.id) && a.timing === 'now') || null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      {/* severity header */}
      <section className={`card relative overflow-hidden p-4 md:p-5 ${verified ? 'border-green-900/60' : 'border-red-900/50'}`}>
        <div className={`pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full blur-[90px] ${verified ? 'bg-green-500/10' : 'bg-red-500/10'}`} />
        <div className="relative flex flex-wrap items-center gap-4">
          <LiveDot color={verified ? 'bg-green-500' : 'bg-red-500'} />
          <div className="min-w-[220px] flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-gray-400">{c.id}</span>
              <span className={`pill ${STATUS_TONE[c.status] || 'pill-gray'}`}>{STATUS_LABEL[c.status] || c.status}</span>
              {!verified && <span className="pill pill-red">Severity: high</span>}
              {c.audit?.cached && (
                <span className="pill pill-gray" title="Served from cached fixture state">
                  <Database size={11} /> cached result
                </span>
              )}
            </div>
            <h1 className="mt-1 text-xl font-bold tracking-tight md:text-2xl">{c.title}</h1>
            <p className="text-xs text-gray-400 md:text-sm">
              {c.asset?.name} / {c.asset?.system}. {c.syntheticDataNote}
            </p>
          </div>
          <button type="button" className="btn-primary w-full px-5 py-2.5 sm:w-auto" onClick={runInvestigation} disabled={isRunning || c.status !== 'open'}>
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {isRunning ? 'Investigating...' : c.status === 'open' ? 'Run investigation' : 'Investigation complete'}
          </button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* left: trace */}
        <Card title="Agent trace" icon={Activity} className="order-2 xl:order-1 xl:col-span-3" bodyClass="max-h-[520px] overflow-y-auto p-4 xl:max-h-[980px]" action={<span className="micro">{c.trace?.length || 0} steps</span>}>
          <TraceTimeline trace={c.trace} running={isRunning} />
        </Card>

        {/* centre: skid and chart */}
        <div className="order-1 space-y-4 xl:order-2 xl:col-span-5">
          <Card
            title="LO-01 lube-oil console"
            icon={Workflow}
            bodyClass="p-2 dot-grid rounded-b-card"
            action={c.diagnosis?.rootCause ? <span className="pill pill-cyan">Root-cause path</span> : <span className="micro">click a component</span>}
          >
            <SkidDiagram caseData={c} onSelect={setSelected} selected={selected} />
          </Card>
          {c.diagnosis?.rootCause && (
            <div className="rounded-card border border-cyan-900/50 bg-cyan-950/10 p-4">
              <MicroLabel className="text-cyan-400">Root cause</MicroLabel>
              <p className="mt-1 text-sm leading-relaxed text-gray-200">{c.diagnosis.rootCause.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[11px] text-cyan-300">
                {c.diagnosis.rootCause.path.map((p, i) => (
                  <span key={p} className="flex items-center gap-1">
                    <button type="button" className="pill pill-cyan" onClick={() => setSelected(COMPONENTS[p] ? p : null)}>
                      {p}
                    </button>
                    {i < c.diagnosis.rootCause.path.length - 1 && <span className="text-gray-600">&rarr;</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Card title="Header pressure and filter dP" icon={LineChart} action={<span className="micro">synthetic, 1 h interval</span>}>
            <SignalChart readings={c.readings} height={250} />
            <div className="mt-2 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-cyan" /> PT-104 barg
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-purple" /> PDT-101 bar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-4 border-t border-dashed border-amber-400" /> SITE SETPOINT (synthetic)
              </span>
            </div>
          </Card>
        </div>

        {/* right: diagnosis and Ask */}
        <div className="order-3 space-y-4 xl:col-span-4">
          <div className="flex gap-1 rounded-card border border-dark-700 bg-dark-800 p-1" role="tablist">
            {[
              ['diagnosis', 'Diagnosis', Stethoscope],
              ['ask', 'Ask LubeGuard', MessageSquareText],
            ].map(([k, label, Icon]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-control px-3 py-2 text-sm font-semibold transition-colors ${tab === k ? 'bg-dark-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                <Icon size={15} className={k === 'ask' ? 'text-accent-purple' : 'text-accent-cyan'} /> {label}
              </button>
            ))}
          </div>

          {tab === 'ask' ? (
            <Card bodyClass="p-3">
              <AskPanel session={session} caseId={caseId} onCite={onCite} heightClass="h-[620px]" />
            </Card>
          ) : (
            <>
              <div className="space-y-3">
                <DetectionBadge detection={c.detection} />
                <PressurePathChip pressurePath={c.pressurePath} />
                <AutostartCard autostart={c.autostart} />
                <ExposureCard impact={c.impact} />
              </div>

              <Card title="4M+1E matrix" icon={Grid3x3} action={<span className="micro">citations validated in code</span>}>
                {c.diagnosis?.matrix || isRunning ? (
                  <MatrixGrid matrix={c.diagnosis?.matrix} evidenceRequests={c.diagnosis?.evidenceRequests} onRequest={sendRequest} requesting={requesting} onCite={onCite} />
                ) : (
                  <EmptyState icon={Grid3x3} title="Not diagnosed yet">
                    Press Run investigation to structure the matrix.
                  </EmptyState>
                )}
              </Card>

              <Card title="Field evidence" icon={Images}>
                <EvidenceGallery evidence={c.evidence} />
              </Card>

              {actions.length > 0 && (
                <Card title="Advisor actions" icon={ListChecks} bodyClass="p-4 space-y-3">
                  <NextBestAction action={nextAction} onCreate={nextAction && !verified ? () => approveActions([nextAction.id]) : null} />
                  <ActionCards decision={c.decision} onApprove={verified ? null : approveActions} approving={approving} />
                </Card>
              )}

              <Card title="Linked tickets" icon={Ticket}>
                <LinkedTickets tickets={caseTickets} />
              </Card>

              <VerificationPanel
                verification={c.verification}
                status={c.status}
                onVerify={verifyFix}
                verifying={verifying}
                canVerify={(c.decision?.approvedActionIds?.length || 0) > 0 || c.status === 'reopened'}
              />
            </>
          )}
        </div>
      </div>
      <ComponentDrawer id={selected} caseData={c} onClose={() => setSelected(null)} />
    </div>
  );
}
