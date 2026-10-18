// Manager console shell: collapsible sidebar, top bar with join code and QR, notification bell, role menu.
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  Siren,
  Ticket,
  Network,
  ChevronLeft,
  ChevronRight,
  Bell,
  QrCode,
  UserCircle2,
  Smartphone,
  RotateCcw,
  LogOut,
  Copy,
  Menu,
  X,
} from 'lucide-react';
import { useNotifications, useSession, refreshNow } from '../../hooks/useData';
import * as api from '../../lib/api';
import { saveSession, clearSession } from '../../lib/session';
import { MODE, MODE_LABEL, DEFAULT_CASE_ID } from '../../lib/config';
import { relTime } from '../../lib/format';
import { SyntheticNote } from '../ui';
import Logo from '../Logo';

export function joinUrl(code) {
  return `${window.location.origin}/e/join?code=${encodeURIComponent(code || '')}`;
}

function useClickAway(ref, onAway) {
  useEffect(() => {
    const fn = (e) => ref.current && !ref.current.contains(e.target) && onAway();
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [ref, onAway]);
}

function NotificationBell({ session }) {
  const { data, unread, loading } = useNotifications(session, 'manager');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const seen = useRef(null);
  useClickAway(ref, () => setOpen(false));

  // Toast new notifications as they arrive.
  useEffect(() => {
    if (loading) return;
    const ids = new Set(data.map((n) => n.id));
    if (seen.current) {
      data.filter((n) => !seen.current.has(n.id)).slice(0, 2).forEach((n) => toast(`${n.title}: ${n.body}`, { icon: <Bell size={16} className="text-accent-cyan" /> }));
    }
    seen.current = ids;
  }, [data, loading]);

  async function openNotification(n) {
    setOpen(false);
    if (!n.read) api.markNotificationRead(n.id, session?.sandboxId).then(refreshNow).catch(() => {});
    if (n.ref?.ticketId && n.event !== 'evidence_received') navigate(`/m/tickets?open=${n.ref.ticketId}`);
    else navigate(`/m/case/${n.ref?.caseId || session?.caseId || DEFAULT_CASE_ID}`);
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn-ghost relative p-2" onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${unread} unread`}>
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-card border border-dark-700 bg-dark-800 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-dark-700 px-4 py-2.5">
              <span className="text-sm font-bold">Notifications</span>
              <span className="micro">{unread} unread</span>
            </div>
            <ul className="max-h-96 overflow-y-auto">
              {data.length === 0 && <li className="px-4 py-6 text-center text-xs text-gray-500">No notifications</li>}
              {data.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openNotification(n)} className="flex w-full gap-2 px-4 py-3 text-left hover:bg-dark-700/60">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-dark-600' : 'bg-accent-cyan'}`} />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-white">{n.title}</span>
                      <span className="block text-xs text-gray-400">{n.body}</span>
                      <span className="block text-[10px] text-gray-600">{relTime(n.at)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JoinCode({ session }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickAway(ref, () => setOpen(false));
  if (!session?.code) return null;
  const url = joinUrl(session.code);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-control border border-dark-600 bg-dark-900 px-2.5 py-1.5 hover:border-accent-cyan/60" aria-label="Show join code and QR">
        <QrCode size={16} className="text-accent-cyan" />
        <span className="hidden text-[10px] uppercase tracking-wider text-gray-400 sm:inline">Join code</span>
        <span className="font-mono text-sm font-bold tracking-[0.2em] text-white">{session.code}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 z-40 mt-2 w-72 rounded-card border border-dark-700 bg-dark-800 p-4 shadow-2xl">
            <div className="text-sm font-bold">Engineer phone</div>
            <p className="mt-1 text-xs text-gray-400">Scan to open the Engineer app in this sandbox.</p>
            <div className="mt-3 flex justify-center rounded-control bg-white p-3">
              <QRCodeSVG value={url} size={180} level="M" />
            </div>
            <button
              type="button"
              className="btn-secondary mt-3 w-full text-xs"
              onClick={() => {
                navigator.clipboard?.writeText(url).then(() => toast.success('Join link copied'), () => {});
              }}
            >
              <Copy size={14} /> Copy join link
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoleMenu({ session }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useClickAway(ref, () => setOpen(false));

  function viewAsEngineer() {
    if (session) saveSession({ ...session, role: 'engineer' });
    setOpen(false);
    navigate('/e');
  }
  async function reset() {
    setOpen(false);
    const id = toast.loading('Resetting demo...');
    try {
      await api.resetDemo(session?.sandboxId);
      refreshNow();
      toast.success('Demo reset to the start of case C-0412', { id });
      navigate(`/m/case/${session?.caseId || DEFAULT_CASE_ID}`);
    } catch (err) {
      toast.error(`Reset failed: ${err.message}`, { id });
    }
  }
  function leave() {
    clearSession();
    navigate('/');
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" className="flex items-center gap-2 rounded-control px-2 py-1.5 hover:bg-dark-700" onClick={() => setOpen((o) => !o)} aria-label="Role menu">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent-purple to-blue-600 text-xs font-bold">DS</span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-xs font-semibold">Dimas</span>
          <span className="block text-[10px] text-gray-400">Maintenance Supervisor</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-card border border-dark-700 bg-dark-800 py-1 shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-gray-400">
              <UserCircle2 size={14} /> Role: Manager
            </div>
            <button type="button" onClick={viewAsEngineer} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-dark-700">
              <Smartphone size={16} className="text-accent-cyan" /> View as Engineer
            </button>
            <button type="button" onClick={reset} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-dark-700">
              <RotateCcw size={16} className="text-amber-400" /> Reset demo
            </button>
            <button type="button" onClick={leave} className="flex w-full items-center gap-2 border-t border-dark-700 px-4 py-2.5 text-sm text-gray-400 hover:bg-dark-700">
              <LogOut size={16} /> Leave sandbox
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NoSession() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    try {
      const s = await api.createSession('manager');
      navigate(`/m/case/${s.caseId}`);
    } catch (err) {
      toast.error(`Could not create a demo session: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-md p-6 text-center">
        <Logo className="mx-auto" />
        <h1 className="mt-4 text-xl font-bold">No demo session yet</h1>
        <p className="mt-2 text-sm text-gray-400">Create a private sandbox with case C-0412 to open the Manager console.</p>
        <button type="button" className="btn-primary mt-5" onClick={start} disabled={busy}>
          Enter as Manager
        </button>
        <div className="mt-3">
          <Link to="/" className="text-xs text-gray-400 hover:text-white">
            Back to the landing page
          </Link>
        </div>
        <SyntheticNote className="mt-5" />
      </div>
    </div>
  );
}

export default function ManagerShell() {
  const session = useSession('manager');
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('optiflow.sidebar') === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('optiflow.sidebar', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  if (!session?.sandboxId) return <NoSession />;
  const caseId = session.caseId || DEFAULT_CASE_ID;
  const nav = [
    { to: '/m', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: `/m/case/${caseId}`, label: 'Incident Room', icon: Siren },
    { to: '/m/tickets', label: 'Tickets', icon: Ticket },
    { to: '/m/graph', label: 'Knowledge Graph', icon: Network },
  ];

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className={`mb-4 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-1 py-2`}>
        <Link to="/" aria-label="Optiflow LubeGuard home">
          <Logo compact={collapsed} />
        </Link>
      </div>
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={label}
          to={to}
          end={end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
              isActive ? 'bg-accent-cyan text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-gray-400 hover:bg-dark-700 hover:text-white'
            } ${collapsed ? 'justify-center' : ''}`
          }
          title={collapsed ? label : undefined}
        >
          <Icon size={20} />
          {!collapsed && <span>{label}</span>}
        </NavLink>
      ))}
      <div className="mt-auto space-y-2">
        {!collapsed && (
          <div className="rounded-control border border-dark-700 bg-dark-900 p-3 text-[11px] text-gray-500">
            <div className="micro mb-1">Sandbox</div>
            <div className="font-mono text-gray-300">{session.sandboxId}</div>
            <div className="mt-1">{MODE_LABEL}</div>
          </div>
        )}
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs text-gray-500 hover:bg-dark-700 hover:text-white md:flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <ChevronRight size={16} /> : (
            <>
              <ChevronLeft size={16} /> Collapse
            </>
          )}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen bg-dark-900">
      <aside className={`sticky top-0 hidden h-screen shrink-0 border-r border-dark-700 bg-dark-800 transition-all duration-300 md:block ${collapsed ? 'w-20' : 'w-60'}`}>{sidebar}</aside>
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div className="absolute inset-0 bg-black/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} />
            <motion.aside className="absolute left-0 top-0 h-full w-64 border-r border-dark-700 bg-dark-800" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}>
              <button type="button" className="btn-ghost absolute right-2 top-3 p-2" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
              {sidebar}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-dark-700 bg-dark-900/80 px-4 backdrop-blur-md">
          <button type="button" className="btn-ghost p-2 md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="hidden min-w-0 items-center gap-2 text-xs text-gray-400 sm:flex">
            <span className="font-semibold text-white">ST-01, Unit 2</span>
            <span>LO-01 lube-oil console</span>
            {MODE !== 'firebase' && <span className="pill pill-gray">{MODE_LABEL}</span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <JoinCode session={session} />
            <NotificationBell session={session} />
            <RoleMenu session={session} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet context={{ session }} />
        </main>
        <footer className="border-t border-dark-700 px-4 py-3">
          <SyntheticNote />
        </footer>
      </div>
    </div>
  );
}
