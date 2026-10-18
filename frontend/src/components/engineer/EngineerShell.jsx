// Engineer PWA shell: mobile-first, glove-friendly (48 px targets), bottom tab bar, offline banner.
import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ListTodo, Camera, Bell, Languages } from 'lucide-react';
import { useNotifications, useSession, refreshNow } from '../../hooks/useData';
import { useLang } from '../../lib/i18n';
import { MODE, MODE_LABEL } from '../../lib/config';
import Logo from '../Logo';
import { OfflineBanner, SyncBadge } from './SyncStatus';
import { SyntheticNote } from '../ui';

export default function EngineerShell() {
  const session = useSession('engineer');
  const { lang, setLang, t } = useLang();
  const { unread } = useNotifications(session, 'engineer');

  useEffect(() => {
    const onSynced = (e) => {
      const { item, result } = e.detail || {};
      if (item?.type === 'evidence') {
        const verdict = result?.judged?.verdict;
        toast.success(verdict ? `Evidence synced and judged ${verdict}` : 'Evidence synced');
      } else if (item?.type === 'complete') toast.success('Report submitted');
      refreshNow();
    };
    window.addEventListener('optiflow:synced', onSynced);
    return () => window.removeEventListener('optiflow:synced', onSynced);
  }, []);

  if (!session?.sandboxId) return <Navigate to="/e/join" replace />;

  const tabs = [
    { to: '/e/tasks', label: t('tasks'), icon: ListTodo },
    { to: '/e/capture', label: t('capture'), icon: Camera },
    { to: '/e/alerts', label: t('alerts'), icon: Bell, badge: unread },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col bg-dark-900">
      <header className="sticky top-0 z-30 border-b border-dark-700 bg-dark-900/90 backdrop-blur-md">
        <div className="flex h-14 items-center gap-2 px-4">
          <Link to="/e/tasks" aria-label="My tasks">
            <Logo />
          </Link>
          <span className="hidden text-[10px] uppercase tracking-wider text-gray-500 min-[400px]:inline">Engineer</span>
          <div className="ml-auto flex items-center gap-2">
            <SyncBadge />
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
              className="inline-flex h-12 min-w-[48px] items-center justify-center gap-1 rounded-control border border-dark-600 bg-dark-800 px-2 text-xs font-bold"
              aria-label="Switch label language"
            >
              <Languages size={16} /> {lang === 'en' ? 'EN' : 'ID'}
            </button>
          </div>
        </div>
        <OfflineBanner />
      </header>
      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet context={{ session }} />
        <div className="mt-8 space-y-1 text-center text-[11px] text-gray-600">
          <div>
            Joko, Field Engineer. Sandbox <span className="font-mono">{session.sandboxId}</span>
            {MODE !== 'firebase' ? ` (${MODE_LABEL})` : ''}
          </div>
          <SyntheticNote />
        </div>
      </main>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-dark-700 bg-dark-800/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-xl grid-cols-3">
          {tabs.map(({ to, label, icon: Icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `relative flex min-h-[64px] flex-col items-center justify-center gap-1 text-sm font-semibold ${isActive ? 'text-accent-cyan' : 'text-gray-400'}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 h-1 w-12 rounded-b-full bg-accent-cyan shadow-[0_0_12px_rgba(6,182,212,0.6)]" />}
                  <span className="relative">
                    <Icon size={24} />
                    {badge ? <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{badge}</span> : null}
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
