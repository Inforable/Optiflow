// Capture tab: choose an open task, then photo, voice or sample evidence for it.
import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { useTickets } from '../../hooks/useData';
import { useLang } from '../../lib/i18n';
import CapturePanel from '../../components/engineer/CapturePanel';
import { EmptyState, Skeleton } from '../../components/ui';

export default function Capture() {
  const { session } = useOutletContext();
  const { t } = useLang();
  const { data, loading } = useTickets(session, 'engineer');
  const open = (data || []).filter((x) => x.status !== 'done' && x.status !== 'verified');
  const [ticketId, setTicketId] = useState('');
  useEffect(() => {
    if (!ticketId && open.length) setTicketId((open.find((x) => x.type === 'evidence_request') || open[0]).id);
  }, [open, ticketId]);
  const ticket = open.find((x) => x.id === ticketId);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('capture')}</h1>
      {loading && <Skeleton className="h-40 w-full" />}
      {!loading && !open.length && (
        <div className="card">
          <EmptyState icon={Inbox} title={t('noTasks')} />
        </div>
      )}
      {open.length > 0 && (
        <>
          <label className="label" htmlFor="task">
            {t('pickTask')}
          </label>
          <select id="task" className="input min-h-[52px] text-base" value={ticketId} onChange={(e) => setTicketId(e.target.value)}>
            {open.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id}: {x.title}
              </option>
            ))}
          </select>
          {ticket && (
            <>
              <Link to={`/e/task/${ticket.id}`} className="block text-sm text-accent-cyan">
                Open the checklist for {ticket.id}
              </Link>
              <CapturePanel session={session} ticket={ticket} />
            </>
          )}
        </>
      )}
    </div>
  );
}
