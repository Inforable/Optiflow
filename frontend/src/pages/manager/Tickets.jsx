// Tickets (MGR-04 to MGR-06): list with status filter, detail drawer (checklist progress,
// evidence, status change, reassign) and a "New ticket" modal.
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Ticket as TicketIcon, Check, X, Minus, Circle, Loader2 } from 'lucide-react';
import { useTickets, useProgress, useCase, refreshNow } from '../../hooks/useData';
import * as api from '../../lib/api';
import { Card, Drawer, Modal, PriorityPill, TicketStatusPill, ProvenanceChip, CitationChip, MicroLabel, EmptyState, Skeleton } from '../../components/ui';
import { EvidenceThumb } from '../../components/manager/CasePanels';
import { relTime, fmtDateTime, TICKET_STATUS_LABEL, TICKET_TYPE_LABEL, ASSIGNEES } from '../../lib/format';
import { DEFAULT_CASE_ID } from '../../lib/config';

const FILTERS = ['all', 'open', 'in_progress', 'on_hold', 'done', 'verified'];

function TicketDrawer({ ticket, session, caseData, onClose }) {
  const { data: progress } = useProgress(session, ticket?.id);
  const [busy, setBusy] = useState(false);
  if (!ticket) return <Drawer open={false} onClose={onClose} />;
  const steps = ticket.checklist || [];
  const evidence = (caseData?.evidence || []).filter((e) => e.ticketId === ticket.id);

  async function patch(changes, msg) {
    setBusy(true);
    try {
      await api.patchTicket(ticket.id, { sandboxId: session.sandboxId, ...changes });
      toast.success(msg);
      refreshNow();
    } catch (err) {
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={Boolean(ticket)} onClose={onClose} title={ticket.title} subtitle={`${ticket.id} / ${TICKET_TYPE_LABEL[ticket.type]} / ${ticket.component}`} width="max-w-lg">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          <PriorityPill priority={ticket.priority} />
          <TicketStatusPill status={ticket.status} />
          <ProvenanceChip provenance={ticket.createdBy} />
          {ticket.actionId ? <span className="pill pill-cyan">Action {ticket.actionId}</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="well p-3">
            <MicroLabel>Due</MicroLabel>
            <div>{fmtDateTime(ticket.dueAt)}</div>
            <div className="text-xs text-gray-500">{relTime(ticket.dueAt)}</div>
          </div>
          <div className="well p-3">
            <MicroLabel>Estimate</MicroLabel>
            <div>{ticket.estimateMin} min</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select id="status" className="input" value={ticket.status} disabled={busy} onChange={(e) => patch({ status: e.target.value }, `Status set to ${TICKET_STATUS_LABEL[e.target.value]}`)}>
              {FILTERS.slice(1).map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="assignee">
              Assignee
            </label>
            <select
              id="assignee"
              className="input"
              value={ticket.assigneeRole}
              disabled={busy}
              onChange={(e) => {
                const a = ASSIGNEES.find((x) => x.role === e.target.value);
                patch({ assigneeRole: a.role, assigneeName: a.name }, `Reassigned to ${a.name}`);
              }}
            >
              {ASSIGNEES.map((a) => (
                <option key={a.role} value={a.role}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {ticket.evidenceRequest ? (
          <div className="rounded-card border border-cyan-900/50 bg-cyan-950/10 p-3 text-sm">
            <MicroLabel className="text-cyan-400">Evidence request ({ticket.evidenceRequest.category})</MicroLabel>
            <p className="mt-1 text-gray-200">{ticket.evidenceRequest.instruction}</p>
          </div>
        ) : null}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <MicroLabel>Checklist progress</MicroLabel>
            <span className="font-mono text-xs text-gray-400">
              {steps.filter((s) => progress[s.id]?.result || progress[s.id]?.done).length}/{steps.length}
            </span>
          </div>
          <ul className="space-y-1.5">
            {steps.map((s) => {
              const p = progress[s.id];
              const Icon = p?.result === 'pass' ? Check : p?.result === 'fail' ? X : p?.result === 'na' ? Minus : Circle;
              const cls = p?.result === 'pass' ? 'text-green-400' : p?.result === 'fail' ? 'text-red-400' : 'text-gray-500';
              return (
                <li key={s.id} className="rounded-control border border-dark-700 bg-dark-900 p-2.5">
                  <div className="flex items-start gap-2">
                    <Icon size={16} className={`mt-0.5 shrink-0 ${cls}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-200">{s.text}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {s.sopRef ? <CitationChip id={s.sopRef} /> : null}
                        {p?.reading ? <span className="pill pill-cyan font-mono">{p.reading}</span> : null}
                        {p?.note ? <span className="text-xs text-gray-400">{p.note}</span> : null}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <MicroLabel className="mb-2">Evidence</MicroLabel>
          {evidence.length ? (
            <div className="flex flex-wrap gap-2">
              {evidence.map((e) => (
                <div key={e.id} className="text-center">
                  <EvidenceThumb ev={e} className="h-20 w-20" />
                  <div className="mt-1 font-mono text-[10px] text-gray-500">{e.id}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No evidence attached yet.</p>
          )}
        </div>
        {ticket.report ? (
          <div className="rounded-card border border-green-900/50 bg-green-950/10 p-3 text-sm">
            <MicroLabel className="text-green-400">Report ({ticket.report.condition})</MicroLabel>
            <p className="mt-1 text-gray-200">{ticket.report.summary}</p>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

const EMPTY = { title: '', type: 'corrective', component: 'F-101A', priority: 'medium', assigneeRole: 'engineer', estimateMin: 30, dueHours: 4, steps: '' };

function NewTicketModal({ open, onClose, session }) {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const valid = f.title.trim().length > 3 && f.component.trim();
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit() {
    setBusy(true);
    try {
      const a = ASSIGNEES.find((x) => x.role === f.assigneeRole);
      const steps = f.steps
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text, i) => ({ id: `s${i + 1}`, text, sopRef: null }));
      const t = await api.createTicket({
        sandboxId: session.sandboxId,
        type: f.type,
        title: f.title.trim(),
        caseId: session.caseId || DEFAULT_CASE_ID,
        component: f.component.trim(),
        priority: f.priority,
        dueAt: new Date(Date.now() + Number(f.dueHours) * 3600000).toISOString(),
        estimateMin: Number(f.estimateMin) || 30,
        assigneeRole: a.role,
        assigneeName: a.name,
        status: 'open',
        checklist: steps,
        evidenceRequest: null,
        createdBy: 'human',
        report: null,
      });
      toast.success(`Ticket ${t?.id || ''} created`);
      setF(EMPTY);
      refreshNow();
      onClose();
    } catch (err) {
      toast.error(`Could not create the ticket: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New ticket"
      icon={TicketIcon}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={!valid || busy} onClick={submit}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Create ticket
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <label className="label" htmlFor="nt-title">
            Title
          </label>
          <input id="nt-title" className="input" value={f.title} onChange={set('title')} placeholder="Inspect filter element F-101A" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="nt-type">
              Type
            </label>
            <select id="nt-type" className="input" value={f.type} onChange={set('type')}>
              {Object.entries(TICKET_TYPE_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nt-comp">
              Component
            </label>
            <input id="nt-comp" className="input font-mono" value={f.component} onChange={set('component')} />
          </div>
          <div>
            <label className="label" htmlFor="nt-pri">
              Priority
            </label>
            <select id="nt-pri" className="input" value={f.priority} onChange={set('priority')}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nt-ass">
              Assignee
            </label>
            <select id="nt-ass" className="input" value={f.assigneeRole} onChange={set('assigneeRole')}>
              {ASSIGNEES.map((a) => (
                <option key={a.role} value={a.role}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nt-due">
              Due in (hours)
            </label>
            <input id="nt-due" type="number" min="1" className="input" value={f.dueHours} onChange={set('dueHours')} />
          </div>
          <div>
            <label className="label" htmlFor="nt-est">
              Estimate (min)
            </label>
            <input id="nt-est" type="number" min="5" className="input" value={f.estimateMin} onChange={set('estimateMin')} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="nt-steps">
            Checklist steps (one per line)
          </label>
          <textarea id="nt-steps" className="input min-h-[96px]" value={f.steps} onChange={set('steps')} placeholder={'Isolate the filter side\nInspect the element\nPhotograph the element'} />
        </div>
      </div>
    </Modal>
  );
}

export default function Tickets() {
  const { session } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const { data, loading } = useTickets(session);
  const { data: caseData } = useCase(session.caseId || DEFAULT_CASE_ID, session);
  const [filter, setFilter] = useState('all');
  const [creating, setCreating] = useState(false);
  const openId = params.get('open');
  const list = data || [];
  const shown = useMemo(() => (filter === 'all' ? list : list.filter((t) => t.status === filter)), [list, filter]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, f === 'all' ? list.length : list.filter((t) => t.status === f).length])), [list]);
  const selected = list.find((t) => t.id === openId) || null;
  const setOpen = (id) => setParams(id ? { open: id } : {});
  useEffect(() => {
    if (openId && !loading && list.length && !selected) setOpen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, loading, list.length]);

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">Tickets</h1>
          <p className="text-xs text-gray-400 md:text-sm">Evidence requests, corrective work and safety tests for case C-0412.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> New ticket
        </button>
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === f ? 'border-accent-cyan bg-accent-cyan/15 text-accent-cyan' : 'border-dark-600 text-gray-400 hover:text-white'}`}
          >
            {f === 'all' ? 'All' : TICKET_STATUS_LABEL[f]} <span className="ml-1 font-mono opacity-70">{counts[f]}</span>
          </button>
        ))}
      </div>
      <Card bodyClass="p-0">
        {loading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState icon={TicketIcon} title="No tickets here">
            Tickets appear when an evidence request is sent or actions are approved in the Incident Room.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-dark-900/50 text-left text-[10px] uppercase tracking-wider text-gray-400">
                <tr>
                  {['Title', 'Type', 'Component', 'Assignee', 'Priority', 'Due', 'Status', 'Created by'].map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} onClick={() => setOpen(t.id)} className="cursor-pointer border-t border-dark-700 hover:bg-dark-700/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{t.title}</div>
                      <div className="font-mono text-[11px] text-gray-500">{t.id}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">{TICKET_TYPE_LABEL[t.type]}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{t.component}</td>
                    <td className="px-4 py-3 text-xs text-gray-300">{t.assigneeName}</td>
                    <td className="px-4 py-3">
                      <PriorityPill priority={t.priority} />
                    </td>
                    <td className={`px-4 py-3 text-xs ${Date.parse(t.dueAt) < Date.now() && !['done', 'verified'].includes(t.status) ? 'text-red-400' : 'text-gray-400'}`}>{relTime(t.dueAt)}</td>
                    <td className="px-4 py-3">
                      <TicketStatusPill status={t.status} />
                    </td>
                    <td className="px-4 py-3">
                      <ProvenanceChip provenance={t.createdBy} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <TicketDrawer ticket={selected} session={session} caseData={caseData} onClose={() => setOpen(null)} />
      <NewTicketModal open={creating} onClose={() => setCreating(false)} session={session} />
    </div>
  );
}
