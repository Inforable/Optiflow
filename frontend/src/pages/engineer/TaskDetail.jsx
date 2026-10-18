// Task detail: SOP checklist with pass / fail / N/A, notes and readings (offline-safe writes),
// evidence capture, and report submission (queued when offline).
import { useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, X, Minus, ShieldAlert, ChevronDown, ChevronUp, Send, Clock, FileText, CloudOff } from 'lucide-react';
import { useProgress, useQueue, useTickets } from '../../hooks/useData';
import { writeProgress } from '../../lib/progress';
import { enqueueComplete } from '../../lib/offlineQueue';
import { useLang } from '../../lib/i18n';
import { relTime } from '../../lib/format';
import { CitationChip, PriorityPill, TicketStatusPill, Skeleton, EmptyState } from '../../components/ui';
import CapturePanel from '../../components/engineer/CapturePanel';
import { ItemState } from '../../components/engineer/SyncStatus';

const SAFETY = /trip|bypass|control room|isolate|close .* side|battery/i;

function StepRow({ index, step, progress, onSave, t }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(progress?.note || '');
  const [reading, setReading] = useState(progress?.reading || '');
  const result = progress?.result;
  const safety = SAFETY.test(step.text);
  const set = (r) => onSave(step.id, { done: true, result: r, note: note || null, reading: reading || null });
  const saveText = () => {
    if ((note || '') === (progress?.note || '') && (reading || '') === (progress?.reading || '')) return;
    onSave(step.id, { done: Boolean(result), result: result || null, note: note || null, reading: reading || null });
  };
  const btn = (r, label, Icon, on) => (
    <button
      type="button"
      onClick={() => set(r)}
      aria-pressed={result === r}
      className={`flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-control border text-base font-bold transition-colors active:scale-95 ${result === r ? on : 'border-dark-600 bg-dark-900 text-gray-300'}`}
    >
      <Icon size={20} strokeWidth={3} /> {label}
    </button>
  );
  return (
    <li className={`rounded-card border p-3 ${safety ? 'border-amber-700/60 bg-amber-950/10' : 'border-dark-700 bg-dark-800'}`}>
      <div className="flex gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-bold ${result === 'pass' ? 'bg-green-500 text-black' : result === 'fail' ? 'bg-red-500 text-white' : result === 'na' ? 'bg-dark-500 text-white' : 'bg-dark-700 text-gray-300'}`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium leading-snug text-white">{step.text}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {step.sopRef ? <CitationChip id={step.sopRef} /> : null}
            {safety ? (
              <span className="pill pill-amber">
                <ShieldAlert size={12} /> {t('safety')}
              </span>
            ) : null}
            {progress?.pending || progress?.queued ? (
              <span className="pill pill-amber">
                <CloudOff size={11} /> pending sync
              </span>
            ) : progress?.at ? (
              <span className="pill pill-green">
                <Check size={11} /> {t('saved')}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {btn('pass', t('pass'), Check, 'border-green-600 bg-green-600/20 text-green-300')}
        {btn('fail', t('fail'), X, 'border-red-600 bg-red-600/20 text-red-300')}
        {btn('na', t('na'), Minus, 'border-dark-500 bg-dark-600 text-white')}
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-1 text-sm text-gray-400">
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />} {t('note')} / {t('reading')}
        {(progress?.note || progress?.reading) && !open ? <span className="ml-1 truncate text-xs text-cyan-300">{progress?.reading || progress?.note}</span> : null}
      </button>
      {open && (
        <div className="mt-1 grid gap-2">
          <input className="input min-h-[48px] text-base" placeholder={t('reading')} value={reading} onChange={(e) => setReading(e.target.value)} onBlur={saveText} inputMode="decimal" />
          <textarea className="input min-h-[72px] text-base" placeholder={t('note')} value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveText} />
        </div>
      )}
    </li>
  );
}

export default function TaskDetail() {
  const { ticketId } = useParams();
  const { session } = useOutletContext();
  const { t } = useLang();
  const { data: tickets, loading } = useTickets(session, 'engineer');
  const { data: serverProgress } = useProgress(session, ticketId);
  const { items } = useQueue();
  const [local, setLocal] = useState({});
  const [summary, setSummary] = useState('');
  const [condition, setCondition] = useState('fair');

  const ticket = (tickets || []).find((x) => x.id === ticketId);
  const queuedProgress = useMemo(() => {
    const out = {};
    for (const it of items) {
      if (it.type === 'progress' && it.state !== 'synced' && it.meta.ticketId === ticketId) out[it.meta.stepId] = { ...it.meta.body, queued: true, at: it.createdAt };
    }
    return out;
  }, [items, ticketId]);
  const progress = useMemo(() => {
    const out = { ...serverProgress };
    for (const [k, v] of Object.entries(queuedProgress)) out[k] = { ...out[k], ...v };
    for (const [k, v] of Object.entries(local)) {
      const s = out[k];
      if (!s?.at || !v.at || v.at >= s.at || s.queued) out[k] = { ...s, ...v };
    }
    return out;
  }, [serverProgress, queuedProgress, local]);
  const completeItem = items.find((i) => i.type === 'complete' && i.meta.ticketId === ticketId && i.state !== 'synced');

  async function save(stepId, data) {
    const at = new Date().toISOString();
    setLocal((l) => ({ ...l, [stepId]: { ...data, at, pending: !navigator.onLine } }));
    try {
      const res = await writeProgress(session, ticketId, stepId, data);
      if (res?.queued) setLocal((l) => ({ ...l, [stepId]: { ...l[stepId], queued: true } }));
      else setLocal((l) => ({ ...l, [stepId]: { ...l[stepId], pending: false } }));
    } catch (err) {
      toast.error(`Could not save: ${err.message}`);
    }
  }

  async function submit() {
    if (!summary.trim()) {
      toast.error('Add a short findings summary');
      return;
    }
    await enqueueComplete(ticketId, session.sandboxId, { summary: summary.trim(), condition }, ticket?.title);
    toast.success(navigator.onLine ? 'Submitting report' : 'Saved offline, report queued');
  }

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!ticket)
    return (
      <div className="card">
        <EmptyState title={`Task ${ticketId} not found`}>
          <Link to="/e/tasks" className="text-accent-cyan">
            {t('back')}
          </Link>
        </EmptyState>
      </div>
    );

  const steps = ticket.checklist || [];
  const doneCount = steps.filter((s) => progress[s.id]?.result).length;
  const finished = ticket.status === 'done' || ticket.status === 'verified';

  return (
    <div className="space-y-5">
      <Link to="/e/tasks" className="inline-flex min-h-[48px] items-center gap-2 text-base text-gray-300">
        <ArrowLeft size={20} /> {t('back')}
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-gray-500">{ticket.id}</span>
          <span className="pill pill-gray font-mono">{ticket.component}</span>
          <PriorityPill priority={ticket.priority} />
          <TicketStatusPill status={ticket.status} />
        </div>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{ticket.title}</h1>
        <div className="mt-1 flex items-center gap-1 text-sm text-gray-400">
          <Clock size={15} /> {t('due')} {relTime(ticket.dueAt)}, about {ticket.estimateMin} min
        </div>
      </div>

      {ticket.evidenceRequest && (
        <div className="rounded-card border border-cyan-900/60 bg-cyan-950/20 p-4">
          <div className="micro text-cyan-400">{t('instruction')}</div>
          <p className="mt-1 text-base text-gray-100">{ticket.evidenceRequest.instruction}</p>
          <div className="mt-2">
            <CitationChip id={ticket.evidenceRequest.sopRef} />
          </div>
        </div>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('checklist')}</h2>
          <span className="font-mono text-sm text-gray-400">
            {doneCount}/{steps.length}
          </span>
        </div>
        <div className="mb-3 h-2 rounded-full bg-dark-700">
          <div className="h-2 rounded-full bg-accent-cyan transition-all" style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }} />
        </div>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <StepRow key={s.id} index={i} step={s} progress={progress[s.id]} onSave={save} t={t} />
          ))}
        </ol>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">{t('evidence')}</h2>
        <CapturePanel session={session} ticket={ticket} />
      </section>

      <section className="rounded-card border border-dark-700 bg-dark-800 p-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FileText size={18} className="text-accent-cyan" /> {t('submitReport')}
        </h2>
        {finished ? (
          <div className="mt-2 space-y-1">
            <span className="pill pill-green">
              <Check size={12} /> {t('reportSent')}
            </span>
            {ticket.report ? (
              <p className="text-sm text-gray-300">
                {ticket.report.summary} ({ticket.report.condition})
              </p>
            ) : null}
          </div>
        ) : completeItem ? (
          <div className="mt-2 flex items-center gap-2 text-sm text-gray-300">
            <ItemState state={completeItem.state} /> Report will submit when online.
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="label" htmlFor="summary">
              {t('summary')}
            </label>
            <textarea id="summary" className="input min-h-[96px] text-base" value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Oil milky and hazy; sample photographed" />
            <div className="label">{t('condition')}</div>
            <div className="grid grid-cols-3 gap-2">
              {['good', 'fair', 'poor'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCondition(c)}
                  aria-pressed={condition === c}
                  className={`min-h-[52px] rounded-control border text-base font-bold ${condition === c ? (c === 'good' ? 'border-green-600 bg-green-600/20 text-green-300' : c === 'fair' ? 'border-amber-600 bg-amber-600/20 text-amber-300' : 'border-red-600 bg-red-600/20 text-red-300') : 'border-dark-600 bg-dark-900 text-gray-300'}`}
                >
                  {t(c)}
                </button>
              ))}
            </div>
            <button type="button" onClick={submit} className="btn-primary min-h-[56px] w-full text-lg">
              <Send size={20} /> {t('submitReport')}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
