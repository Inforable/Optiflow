// Shared UI primitives in the LubeGuard (Proteus-style) visual language.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, Check, CircleHelp, Database, Info, User, X, XCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { TICKET_STATUS_LABEL } from '../../lib/format';

// ---------- status (always colour plus icon) ----------
const VERDICT = {
  G: { cls: 'pill-green', Icon: Check, label: 'Good', short: 'G' },
  NG: { cls: 'pill-red', Icon: X, label: 'Not good', short: 'NG' },
  UNVERIFIED: { cls: 'pill-amber', Icon: CircleHelp, label: 'Unverified', short: 'UNVERIFIED' },
};

export function StatusPill({ verdict, size = 'sm', long = false, iconOnly = false, className = '' }) {
  const v = VERDICT[verdict] || VERDICT.UNVERIFIED;
  const { Icon } = v;
  return (
    <span className={`pill ${v.cls} ${size === 'lg' ? 'px-2.5 py-1 text-xs' : ''} ${iconOnly ? 'px-1.5' : ''} ${className}`} title={v.label} aria-label={v.label}>
      <Icon size={size === 'lg' ? 14 : 12} strokeWidth={3} aria-hidden />
      {iconOnly ? null : long ? v.label : v.short}
    </span>
  );
}

export function VerdictIcon({ verdict, size = 16 }) {
  if (verdict === 'G') return <CheckCircle2 size={size} className="text-green-400" aria-label="Good" />;
  if (verdict === 'NG') return <XCircle size={size} className="text-red-400" aria-label="Not good" />;
  return <HelpCircle size={size} className="text-amber-400" aria-label="Unverified" />;
}

export function ProvenanceChip({ provenance, className = '' }) {
  const human = provenance === 'human';
  return (
    <span className={`pill ${human ? 'pill-blue' : 'pill-purple'} ${className}`} title={human ? 'Produced by a person' : 'Produced by AI'}>
      {human ? <User size={11} aria-hidden /> : <Bot size={11} aria-hidden />}
      {human ? 'Human' : 'AI'}
    </span>
  );
}

const CITE_STYLE = {
  rule: 'pill-cyan',
  sop: 'pill-green',
  evidence: 'pill-blue',
  incident: 'pill-amber',
  component: 'pill-gray',
  tag: 'pill-gray',
  failure_mode: 'pill-red',
};

export function citationType(id = '') {
  if (/^SOP-/.test(id)) return 'sop';
  if (/^R-|^R\d/.test(id)) return 'rule';
  if (/^EV-|^evidence:|^ev_/.test(id)) return 'evidence';
  if (/^INC-/.test(id)) return 'incident';
  if (/^F\d+$/.test(id)) return 'failure_mode';
  return 'component';
}

export function CitationChip({ id, type, label, onClick }) {
  const t = type || citationType(id);
  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick ? () => onClick(id) : undefined}
      className={`pill font-mono ${CITE_STYLE[t] || 'pill-gray'} ${onClick ? 'hover:brightness-125 cursor-pointer' : ''}`}
      title={label || id}
    >
      {t === 'evidence' ? <Database size={10} aria-hidden /> : null}
      {id.replace(/^evidence:/, '')}
    </Comp>
  );
}

export function PriorityPill({ priority }) {
  const cls = priority === 'high' ? 'pill-red' : priority === 'medium' ? 'pill-amber' : 'pill-gray';
  return <span className={`pill ${cls} uppercase`}>{priority}</span>;
}

export function TicketStatusPill({ status }) {
  const cls = {
    open: 'pill-cyan',
    in_progress: 'pill-blue',
    on_hold: 'pill-amber',
    done: 'pill-green',
    verified: 'pill-purple',
  }[status];
  return <span className={`pill ${cls || 'pill-gray'}`}>{TICKET_STATUS_LABEL[status] || status}</span>;
}

// ---------- layout ----------
export function Card({ title, icon: Icon, action, children, className = '', bodyClass = 'p-4', accent }) {
  return (
    <section className={`card ${accent || ''} ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-dark-700 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            {Icon ? <Icon size={16} className="text-accent-cyan" aria-hidden /> : null}
            {title}
          </h3>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function MicroLabel({ children, className = '' }) {
  return <div className={`micro ${className}`}>{children}</div>;
}

export function KpiCard({ label, value, sub, icon: Icon, tone = 'cyan', title }) {
  const toneCls = {
    cyan: 'text-accent-cyan',
    purple: 'text-accent-purple',
    green: 'text-accent-success',
    red: 'text-accent-danger',
    amber: 'text-accent-warning',
  }[tone];
  return (
    <div className="card p-5" title={title}>
      <div className="flex items-start justify-between">
        <MicroLabel>{label}</MicroLabel>
        {Icon ? (
          <div className="rounded-control bg-dark-900 p-2 shadow-inner">
            <Icon size={16} className={toneCls} aria-hidden />
          </div>
        ) : null}
      </div>
      <div className="mt-2 font-mono text-2xl font-bold tabular-nums text-white md:text-3xl">{value}</div>
      {sub ? <div className="mt-1 text-xs text-gray-500">{sub}</div> : null}
    </div>
  );
}

export function Skeleton({ className = 'h-4 w-full' }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({ icon: Icon = Info, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <Icon size={32} className="text-dark-500" aria-hidden />
      <div className="text-sm font-semibold text-gray-300">{title}</div>
      {children ? <div className="max-w-sm text-xs text-gray-500">{children}</div> : null}
    </div>
  );
}

export function SyntheticNote({ className = '' }) {
  return (
    <p className={`text-center text-[11px] text-gray-500 ${className}`}>
      Synthetic demo data. SITE SETPOINTS are not standards. Optiflow LubeGuard, built during the Google Cloud AI Builder Cup 2026.
    </p>
  );
}

export function Tooltip({ content, children, className = '' }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="tooltip"
            className="absolute bottom-full right-0 z-50 mb-2 w-72 rounded-control border border-dark-600 bg-dark-950 p-3 text-left text-xs font-normal normal-case tracking-normal text-gray-300 shadow-xl"
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

// ---------- overlays ----------
function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const fn = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [open, onClose]);
}

export function Drawer({ open, onClose, title, subtitle, children, width = 'max-w-md' }) {
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className={`absolute right-0 top-0 flex h-full w-full ${width} flex-col border-l border-dark-700 bg-dark-800 shadow-2xl`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Details'}
          >
            <header className="flex items-start justify-between gap-3 border-b border-dark-700 p-5">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-white">{title}</h2>
                {subtitle ? <div className="mt-0.5 text-xs text-gray-400">{subtitle}</div> : null}
              </div>
              <button type="button" className="btn-ghost p-2" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Modal({ open, onClose, title, icon: Icon, children, footer }) {
  useEscape(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            className="relative w-full max-w-lg rounded-modal border border-dark-700 bg-dark-800 shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-center justify-between border-b border-dark-700 p-5 md:p-6 pb-4">
              <h2 className="flex items-center gap-2 text-lg font-bold">
                {Icon ? <Icon size={18} className="text-accent-cyan" /> : null}
                {title}
              </h2>
              <button type="button" className="btn-ghost p-2" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="max-h-[70vh] overflow-y-auto p-5 md:p-6">{children}</div>
            {footer ? <footer className="flex justify-end gap-2 border-t border-dark-700 p-4">{footer}</footer> : null}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function Spinner({ size = 16, className = '' }) {
  return (
    <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function LiveDot({ color = 'bg-red-500' }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
    </span>
  );
}
