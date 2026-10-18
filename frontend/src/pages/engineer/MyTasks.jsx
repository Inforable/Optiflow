// My Tasks: tickets assigned to the engineer, as large cards (component, priority, due, steps).
import { Link, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Camera, Wrench, ShieldAlert, Clock, ListChecks, Inbox } from 'lucide-react';
import { useTickets } from '../../hooks/useData';
import { useLang } from '../../lib/i18n';
import { relTime } from '../../lib/format';
import { PriorityPill, TicketStatusPill, ProvenanceChip, Skeleton, EmptyState } from '../../components/ui';

const TYPE_ICON = { evidence_request: Camera, corrective: Wrench, safety_test: ShieldAlert };
const ORDER = { open: 0, in_progress: 1, on_hold: 2, done: 3, verified: 4 };

export default function MyTasks() {
  const { session } = useOutletContext();
  const { data, loading } = useTickets(session, 'engineer');
  const { t } = useLang();
  const list = [...(data || [])].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || String(a.dueAt).localeCompare(String(b.dueAt)));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('myTasks')}</h1>
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      )}
      {!loading && list.length === 0 && (
        <div className="card">
          <EmptyState icon={Inbox} title={t('noTasks')} />
        </div>
      )}
      {list.map((tk, i) => {
        const Icon = TYPE_ICON[tk.type] || Wrench;
        const done = tk.status === 'done' || tk.status === 'verified';
        const overdue = !done && Date.parse(tk.dueAt) < Date.now();
        return (
          <motion.div key={tk.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link
              to={`/e/task/${tk.id}`}
              className={`block rounded-card border p-4 transition-colors active:scale-[0.99] ${done ? 'border-dark-700 bg-dark-800/50 opacity-70' : tk.priority === 'high' ? 'border-red-900/60 bg-dark-800' : 'border-dark-700 bg-dark-800'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`rounded-control p-2.5 ${tk.type === 'evidence_request' ? 'bg-cyan-900/30 text-accent-cyan' : tk.type === 'safety_test' ? 'bg-amber-900/30 text-amber-400' : 'bg-dark-700 text-gray-200'}`}>
                  <Icon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold leading-snug text-white">{tk.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="pill pill-gray font-mono">{tk.component}</span>
                    <PriorityPill priority={tk.priority} />
                    <TicketStatusPill status={tk.status} />
                    <ProvenanceChip provenance={tk.createdBy} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-400">
                    <span className={`flex items-center gap-1 ${overdue ? 'font-semibold text-red-400' : ''}`}>
                      <Clock size={15} /> {t('due')} {relTime(tk.dueAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks size={15} /> {tk.checklist?.length || 0} {t('steps')}
                    </span>
                    <span className="font-mono text-xs text-gray-600">{tk.id}</span>
                  </div>
                </div>
                <ChevronRight size={22} className="mt-1 shrink-0 text-gray-500" />
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
