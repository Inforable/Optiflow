// Alerts tab: engineer notifications (new assignments, evidence requests, changes).
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Bell, ChevronRight } from 'lucide-react';
import { useNotifications, refreshNow } from '../../hooks/useData';
import * as api from '../../lib/api';
import { useLang } from '../../lib/i18n';
import { relTime } from '../../lib/format';
import { EmptyState } from '../../components/ui';

export default function Alerts() {
  const { session } = useOutletContext();
  const { t } = useLang();
  const navigate = useNavigate();
  const { data } = useNotifications(session, 'engineer');

  function open(n) {
    if (!n.read) api.markNotificationRead(n.id, session.sandboxId).then(refreshNow).catch(() => {});
    if (n.ref?.ticketId) navigate(`/e/task/${n.ref.ticketId}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('alerts')}</h1>
      {!data.length && (
        <div className="card">
          <EmptyState icon={Bell} title={t('noAlerts')} />
        </div>
      )}
      <ul className="space-y-2">
        {data.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => open(n)} className={`flex min-h-[64px] w-full items-center gap-3 rounded-card border p-4 text-left ${n.read ? 'border-dark-700 bg-dark-800/50' : 'border-cyan-900/60 bg-dark-800'}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-dark-600' : 'bg-accent-cyan'}`} />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-white">{n.title}</span>
                <span className="block text-sm text-gray-400">{n.body}</span>
                <span className="block text-xs text-gray-600">{relTime(n.at)}</span>
              </span>
              {n.ref?.ticketId ? <ChevronRight size={20} className="text-gray-500" /> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
