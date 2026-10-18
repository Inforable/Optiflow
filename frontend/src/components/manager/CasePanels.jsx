// Right-column cards of the Incident Room: detection, pressure path, auto-start readiness,
// exposure, evidence gallery, next best action and action cards, linked tickets, verification.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Radar,
  GitBranch,
  Zap,
  DollarSign,
  Info,
  Image as ImageIcon,
  Mic,
  Target,
  CheckSquare,
  Square,
  ShieldCheck,
  Clock,
  Loader2,
  Ticket,
  ArrowRight,
  BadgeCheck,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CitationChip, ProvenanceChip, StatusPill, Tooltip, PriorityPill, TicketStatusPill, MicroLabel } from '../ui';
import { fmtUsd, fmtNum, CATEGORY_LABEL } from '../../lib/format';
import { MODE } from '../../lib/config';
import { firebaseReady } from '../../lib/firebase';

export function DetectionBadge({ detection }) {
  if (!detection) return null;
  const anomalous = detection.tags.filter((t) => t.anomalous);
  const physical = detection.driftCheck?.verdict === 'physical';
  return (
    <div className="rounded-card border border-dark-700 bg-dark-900/60 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Radar size={16} className="text-accent-cyan" /> Detection
        </div>
        <span className={`pill ${physical ? 'pill-red' : 'pill-amber'}`}>{physical ? 'Physical, not sensor drift' : 'Instrument suspect'}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {anomalous.map((t) => (
          <span key={t.tag} className="pill pill-amber font-mono" title={`p=${t.probability}, slope ${t.slopePerDay}/day`}>
            {t.tag} {t.slopePerDay > 0 ? '+' : ''}
            {fmtNum(t.slopePerDay, 2)}/d
          </span>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-500">
        {anomalous.length} of {detection.tags.length} signals anomalous. {detection.method}. {detection.driftCheck?.reason}
      </p>
    </div>
  );
}

export function PressurePathChip({ pressurePath }) {
  if (!pressurePath) return null;
  return (
    <div className="rounded-card border border-dark-700 bg-dark-900/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <GitBranch size={16} className="text-accent-cyan" /> Pressure path
        </div>
        <div className="flex items-center gap-1">
          <span className="pill pill-red">{pressurePath.label}</span>
          <CitationChip id={pressurePath.ruleId} />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-gray-400">{pressurePath.evidence}</p>
    </div>
  );
}

export function AutostartCard({ autostart }) {
  if (!autostart) return null;
  const overdue = autostart.lastTestDays > autostart.sopIntervalDays;
  const pct = Math.min(100, (autostart.lastTestDays / Math.max(autostart.sopIntervalDays, 1)) * 100);
  return (
    <div className={`rounded-card border p-3 ${autostart.verdict === 'NG' ? 'border-red-900/50 bg-red-950/10' : 'border-dark-700 bg-dark-900/60'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Zap size={16} className="text-amber-400" /> Auto-start readiness
        </div>
        <div className="flex items-center gap-1">
          <StatusPill verdict={autostart.verdict} />
          <CitationChip id={autostart.ruleId} />
        </div>
      </div>
      <p className="mt-1.5 text-xs text-gray-300">{autostart.label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div className="well p-2">
          <MicroLabel>Last test</MicroLabel>
          <div className={`font-mono text-base font-bold ${overdue ? 'text-red-400' : 'text-white'}`}>
            {autostart.lastTestDays} d <span className="text-[10px] font-normal text-gray-500">/ {autostart.sopIntervalDays} d SOP</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-dark-700">
            <div className={`h-1.5 rounded-full ${overdue ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="well p-2">
          <MicroLabel>Margin to PSL-104</MicroLabel>
          <div className="font-mono text-base font-bold text-amber-400">{fmtNum(autostart.marginToPslBar, 2)} bar</div>
          <div className="text-[10px] text-gray-500">SITE SETPOINT (synthetic)</div>
        </div>
      </div>
    </div>
  );
}

export function ExposureCard({ impact }) {
  if (!impact) return null;
  return (
    <div className="rounded-card border border-dark-700 bg-dark-900/60 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold">
          <DollarSign size={16} className="text-accent-cyan" /> Exposure
        </div>
        <span className="pill pill-gray">synthetic</span>
      </div>
      <div className="mt-1 flex items-end gap-2">
        <div className="font-mono text-2xl font-bold text-white">{fmtUsd(impact.exposureUsd)}</div>
        <Tooltip
          content={
            <div className="space-y-1.5">
              <div className="font-semibold text-white">Formula (computed in code)</div>
              <div className="font-mono text-[11px] text-cyan-300">{impact.formula}</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {impact.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          }
        >
          <button type="button" className="mb-1 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white" aria-label="Show exposure formula">
            <Info size={12} /> formula
          </button>
        </Tooltip>
      </div>
      <p className="text-[11px] text-gray-500">If the bearing wipes. Loss now: {fmtUsd(impact.lossPerMinUsd)}/min.</p>
    </div>
  );
}

function sampleUrl(storagePath) {
  const m = /^samples\/([a-z_]+)\./.exec(storagePath || '');
  return m ? `/samples/${m[1]}.svg` : null;
}

export function EvidenceThumb({ ev, className = 'h-20 w-20' }) {
  const [url, setUrl] = useState(() => sampleUrl(ev.storagePath));
  useEffect(() => {
    let alive = true;
    if (!url && MODE === 'firebase' && ev.kind !== 'voice' && ev.storagePath?.startsWith('sandboxes/')) {
      firebaseReady()
        .then(async (fb) => {
          const { ref, getDownloadURL } = await import('firebase/storage');
          const u = await getDownloadURL(ref(fb.storage, ev.storagePath));
          if (alive) setUrl(u);
        })
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [ev.storagePath, ev.kind, url]);
  if (ev.kind === 'voice')
    return (
      <div className={`${className} flex shrink-0 items-center justify-center rounded-control border border-dark-700 bg-dark-900`}>
        <Mic size={22} className="text-blue-400" />
      </div>
    );
  return url ? (
    <img src={url} alt={`Evidence ${ev.id}`} className={`${className} shrink-0 rounded-control border border-dark-700 object-cover`} />
  ) : (
    <div className={`${className} flex shrink-0 items-center justify-center rounded-control border border-dark-700 bg-dark-900`}>
      <ImageIcon size={22} className="text-gray-500" />
    </div>
  );
}

export function EvidenceGallery({ evidence = [] }) {
  if (!evidence.length) return <p className="text-xs text-gray-500">No field evidence yet. Send an evidence request from an Unverified cell.</p>;
  return (
    <div className="space-y-2">
      {evidence.map((ev) => (
        <motion.div key={ev.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-card border border-dark-700 bg-dark-900/60 p-2.5">
          <EvidenceThumb ev={ev} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-white">{ev.id}</span>
              <span className="pill pill-gray">{ev.kind}</span>
              <ProvenanceChip provenance="human" />
              {ev.judged ? <StatusPill verdict={ev.judged.verdict} /> : <span className="pill pill-gray">judging</span>}
              {ev.judged ? <ProvenanceChip provenance="ai" /> : null}
            </div>
            {ev.judged ? (
              <>
                <p className="mt-1 text-xs text-gray-200">{ev.judged.finding}</p>
                <p className="text-[11px] text-gray-500">
                  {ev.judged.reason} Confidence {Math.round((ev.judged.confidence || 0) * 100)}%.
                </p>
                {ev.judged.transcript ? <p className="mt-1 text-[11px] italic text-blue-300">&quot;{ev.judged.transcript}&quot;</p> : null}
              </>
            ) : null}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const QUADRANT = {
  quick_win: ['Quick win', 'pill-green'],
  major: ['Major', 'pill-blue'],
  escalate: ['Escalate', 'pill-red'],
  deprioritize: ['Deprioritize', 'pill-gray'],
};
const AUTHORITY = { shift: 'Shift authority', plant: 'Plant manager', ho: 'Head office' };

export function NextBestAction({ action, onCreate }) {
  if (!action) return null;
  return (
    <div className="relative overflow-hidden rounded-card border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-dark-800 p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
        <Target size={14} /> Next best action
      </div>
      <div className="mt-1 text-base font-bold text-white">{action.title}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {action.sopCitations.map((c) => (
          <CitationChip key={c} id={c} />
        ))}
        <ProvenanceChip provenance="ai" />
      </div>
      {onCreate ? (
        <button type="button" onClick={onCreate} className="btn-primary mt-3 px-3 py-1.5 text-xs">
          Approve and create ticket <ArrowRight size={14} />
        </button>
      ) : null}
    </div>
  );
}

export function ActionCards({ decision, onApprove, approving }) {
  const actions = decision?.actions || [];
  const approved = new Set(decision?.approvedActionIds || []);
  const [picked, setPicked] = useState(() => new Set(actions.filter((a) => a.timing === 'now' && a.quadrant === 'quick_win').map((a) => a.id)));
  useEffect(() => {
    setPicked(new Set(actions.filter((a) => a.timing === 'now' && a.quadrant === 'quick_win' && !approved.has(a.id)).map((a) => a.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions.length, decision?.approvedActionIds?.length]);
  if (!actions.length) return null;
  const toggle = (id) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const pending = [...picked].filter((id) => !approved.has(id));
  return (
    <div className="space-y-2">
      {decision.timingNote ? <p className="rounded-control border border-dark-700 bg-dark-900/60 p-2 text-[11px] text-gray-400">{decision.timingNote}</p> : null}
      {actions.map((a) => {
        const isApproved = approved.has(a.id);
        const checked = isApproved || picked.has(a.id);
        const [qLabel, qCls] = QUADRANT[a.quadrant] || ['', 'pill-gray'];
        return (
          <div key={a.id} className={`rounded-card border p-3 transition-colors ${checked ? 'border-cyan-800/60 bg-cyan-950/10' : 'border-dark-700 bg-dark-900/60'}`}>
            <div className="flex gap-2.5">
              <button
                type="button"
                className="mt-0.5 shrink-0 text-accent-cyan disabled:text-green-400"
                onClick={() => toggle(a.id)}
                disabled={isApproved}
                aria-label={`${checked ? 'Unselect' : 'Select'} ${a.id}`}
                aria-pressed={checked}
              >
                {checked ? <CheckSquare size={18} /> : <Square size={18} className="text-gray-500" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs text-gray-500">{a.id}</span>
                  <span className="text-sm font-semibold text-white">{a.title}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <span className={`pill ${qCls}`}>{qLabel}</span>
                  <span className="pill pill-gray">
                    <ShieldCheck size={11} /> {AUTHORITY[a.authority]}
                  </span>
                  <span className={`pill ${a.timing === 'now' ? 'pill-cyan' : 'pill-gray'}`}>
                    <Clock size={11} /> {a.timing === 'now' ? 'Now' : 'Next shutdown'}
                  </span>
                  <span className="pill pill-gray">{CATEGORY_LABEL[a.category]}</span>
                  {isApproved ? (
                    <span className="pill pill-green">
                      <BadgeCheck size={11} /> Approved
                    </span>
                  ) : null}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {a.sopCitations.map((c) => (
                    <CitationChip key={c} id={c} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {onApprove ? (
        <button type="button" className="btn-primary w-full" disabled={!pending.length || approving} onClick={() => onApprove(pending)}>
          {approving ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
          Approve selected ({pending.length})
        </button>
      ) : null}
    </div>
  );
}

export function LinkedTickets({ tickets = [] }) {
  if (!tickets.length) return <p className="text-xs text-gray-500">No tickets yet.</p>;
  return (
    <ul className="divide-y divide-dark-700">
      {tickets.map((t) => (
        <li key={t.id} className="flex items-center gap-2 py-2">
          <Ticket size={14} className="shrink-0 text-gray-500" />
          <span className="font-mono text-xs text-gray-400">{t.id}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-gray-200">{t.title}</span>
          <PriorityPill priority={t.priority} />
          <TicketStatusPill status={t.status} />
        </li>
      ))}
      <li className="pt-2">
        <Link to="/m/tickets" className="inline-flex items-center gap-1 text-xs text-accent-cyan hover:underline">
          Open tickets <ArrowRight size={12} />
        </Link>
      </li>
    </ul>
  );
}

export function VerificationPanel({ verification, status, onVerify, verifying, canVerify }) {
  const v = verification || { status: 'pending', checks: [] };
  const effective = v.status === 'verified_effective';
  const reopened = v.status === 'reopened';
  return (
    <div className={`rounded-card border p-3 ${effective ? 'border-green-800/60 bg-green-950/10' : reopened ? 'border-red-800/60 bg-red-950/10' : 'border-dark-700 bg-dark-900/60'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold">
          {reopened ? <RotateCcw size={16} className="text-red-400" /> : <BadgeCheck size={16} className={effective ? 'text-green-400' : 'text-gray-500'} />}
          Verification
        </div>
        {effective ? (
          <span className="pill pill-green glow-success">Verified effective</span>
        ) : reopened ? (
          <span className="pill pill-red">Reopened</span>
        ) : (
          <span className="pill pill-gray">Pending</span>
        )}
      </div>
      {v.checks?.length ? (
        <table className="mt-2 w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
              <th className="py-1">Tag</th>
              <th>Baseline</th>
              <th>Band</th>
              <th>Last</th>
              <th />
            </tr>
          </thead>
          <tbody className="font-mono">
            {v.checks.map((c) => (
              <tr key={c.tag} className="border-t border-dark-700">
                <td className="py-1.5 text-gray-300">{c.tag}</td>
                <td>{c.baseline}</td>
                <td>&plusmn;{c.band}</td>
                <td className={c.passed ? 'text-green-400' : 'text-red-400'}>{c.last}</td>
                <td className="text-right">
                  <StatusPill verdict={c.passed ? 'G' : 'NG'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-1.5 text-xs text-gray-500">After the approved work is done, replay post-repair data and compare PT-104, PDT-101 and TE-201 with their baselines.</p>
      )}
      {onVerify && !effective ? (
        <button type="button" className="btn-secondary mt-3 w-full" onClick={onVerify} disabled={!canVerify || verifying} title={canVerify ? '' : 'Approve actions first'}>
          {verifying ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
          Verify fix
        </button>
      ) : null}
      {status === 'verified' ? <p className="mt-2 text-[11px] text-gray-500">Written back to the knowledge graph as a verified fix.</p> : null}
    </div>
  );
}
