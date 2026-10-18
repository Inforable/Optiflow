// OfflineBanner ("Offline: 2 items queued") and SyncBadge for the Engineer app.
import { WifiOff, CloudUpload, CheckCircle2, AlertTriangle, Loader2, Clock, RotateCw } from 'lucide-react';
import { useOnline, useQueue } from '../../hooks/useData';
import { useLang } from '../../lib/i18n';
import { processQueue } from '../../lib/offlineQueue';

export function OfflineBanner() {
  const online = useOnline();
  const { pendingCount, failedCount } = useQueue();
  const { t } = useLang();
  if (online && !pendingCount) return null;
  if (!online)
    return (
      <div className="flex items-center gap-2 bg-amber-500 px-4 py-2.5 text-sm font-bold text-black" role="status">
        <WifiOff size={18} />
        {t('offline')}: {pendingCount} {t('itemsQueued')}
      </div>
    );
  return (
    <div className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold ${failedCount ? 'bg-red-900/60 text-red-100' : 'bg-cyan-900/50 text-cyan-100'}`} role="status">
      {failedCount ? <AlertTriangle size={16} /> : <Loader2 size={16} className="animate-spin" />}
      {failedCount ? `${failedCount} failed, ${pendingCount} pending` : `Syncing ${pendingCount} ${t('itemsQueued')}`}
      {failedCount ? (
        <button type="button" className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-control bg-white/10 px-3 text-xs" onClick={() => processQueue()}>
          <RotateCw size={14} /> Retry
        </button>
      ) : null}
    </div>
  );
}

export function SyncBadge() {
  const online = useOnline();
  const { pendingCount, failedCount, items } = useQueue();
  const { t } = useLang();
  const uploading = items.some((i) => i.state === 'uploading');
  let cls = 'pill-green';
  let Icon = CheckCircle2;
  let label = t('allSynced');
  if (failedCount) {
    cls = 'pill-red';
    Icon = AlertTriangle;
    label = `${failedCount} failed`;
  } else if (uploading) {
    cls = 'pill-cyan';
    Icon = CloudUpload;
    label = 'Syncing';
  } else if (pendingCount) {
    cls = 'pill-amber';
    Icon = Clock;
    label = `${pendingCount} queued`;
  } else if (!online) {
    cls = 'pill-amber';
    Icon = WifiOff;
    label = t('offline');
  }
  return (
    <span className={`pill ${cls} px-2.5 py-1 text-xs`}>
      <Icon size={13} className={uploading ? 'animate-pulse' : ''} /> {label}
    </span>
  );
}

const STATE = {
  queued: ['pill-amber', 'Queued', Clock],
  uploading: ['pill-cyan', 'Uploading', CloudUpload],
  synced: ['pill-green', 'Synced', CheckCircle2],
  failed: ['pill-red', 'Failed', AlertTriangle],
};

export function ItemState({ state }) {
  const [cls, label, Icon] = STATE[state] || STATE.queued;
  return (
    <span className={`pill ${cls}`}>
      <Icon size={12} className={state === 'uploading' ? 'animate-pulse' : ''} /> {label}
    </span>
  );
}
