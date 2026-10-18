// Landing page (PRD 8.1, LND-01 to LND-09). Only cited numbers; plant data is synthetic.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  LayoutDashboard,
  Smartphone,
  ShieldCheck,
  DollarSign,
  BadgeCheck,
  Radar,
  Camera,
  WifiOff,
  ClipboardCheck,
  LineChart,
  Bot,
  Menu,
  X,
  Github,
  ArrowRight,
  Loader2,
  Gauge,
  Thermometer,
  Droplets,
  Filter,
  Siren,
  Ticket,
  Network,
  Mic,
} from 'lucide-react';
import * as api from '../lib/api';
import { REPO_URL } from '../lib/config';
import { loadFixture } from '../lib/fixtureBackend';
import Logo from '../components/Logo';
import SkidDiagram from '../components/manager/SkidDiagram';
import { StatusPill, CitationChip, ProvenanceChip } from '../components/ui';

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};
const Reveal = ({ children, className = '', delay = 0 }) => (
  <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} transition={{ delay }} className={className}>
    {children}
  </motion.div>
);

// Fallback numbers taken from fixtures/case_C0412_open.json (used if the file cannot be fetched).
const FALLBACK = {
  pt: [1.6, 1.58, 1.55, 1.52, 1.49, 1.45, 1.42, 1.39, 1.36, 1.33, 1.3],
  last: { 'PT-104': 1.303, 'PDT-101': 0.889, 'TE-201': 93.986, 'LT-101': 71.901 },
};

function usePreviewCase() {
  const [c, setC] = useState(null);
  useEffect(() => {
    let alive = true;
    loadFixture('case_C0412_open')
      .then((d) => alive && setC(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return c;
}

function Sparkline({ values, className = '' }) {
  const d = useMemo(() => {
    if (!values?.length) return '';
    const min = Math.min(...values, 1.1);
    const max = Math.max(...values);
    return values.map((v, i) => `${i ? 'L' : 'M'}${(i / (values.length - 1)) * 300} ${70 - ((v - min) / (max - min || 1)) * 60}`).join(' ');
  }, [values]);
  const min = Math.min(...(values || [1]), 1.1);
  const max = Math.max(...(values || [1]));
  const alarmY = 70 - ((1.2 - min) / (max - min || 1)) * 60;
  return (
    <svg viewBox="0 0 300 80" className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="spark" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#06B6D4" stopOpacity="0.35" />
          <stop offset="1" stopColor="#06B6D4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2="300" y1={alarmY} y2={alarmY} stroke="#F59E0B" strokeDasharray="5 4" strokeWidth="1" />
      <path d={`${d} L300 80 L0 80 Z`} fill="url(#spark)" />
      <path d={d} fill="none" stroke="#06B6D4" strokeWidth="2" />
    </svg>
  );
}

function ProductPreview({ c }) {
  const series = c?.readings?.series;
  const pt = series ? series['PT-104'].filter((_, i) => i % 6 === 0).map((p) => p[1]) : FALLBACK.pt;
  const last = (tag) => (series ? series[tag][series[tag].length - 1][1] : FALLBACK.last[tag]);
  const matrix = c?.diagnosis?.matrix;
  const tiles = [
    { label: 'Header pressure', tag: 'PT-104', value: `${last('PT-104').toFixed(2)} barg`, icon: Gauge, tone: 'text-amber-400' },
    { label: 'Filter dP', tag: 'PDT-101', value: `${last('PDT-101').toFixed(2)} bar`, icon: Filter, tone: 'text-amber-400' },
    { label: 'Bearing 1 temp', tag: 'TE-201', value: `${last('TE-201').toFixed(1)} degC`, icon: Thermometer, tone: 'text-white' },
    { label: 'Water in oil (lab, 21 d old)', tag: 'WATER-PPM', value: '140 ppm', icon: Droplets, tone: 'text-white' },
  ];
  return (
    <div className="relative mx-auto max-w-6xl">
      <div className="absolute inset-x-10 -bottom-6 h-24 rounded-full bg-accent-cyan/30 blur-[50px]" aria-hidden />
      <div className="relative overflow-hidden rounded-xl border border-dark-700 bg-dark-900 shadow-2xl shadow-cyan-500/20">
        <div className="flex items-center gap-2 rounded-t-xl border-b border-dark-700 bg-dark-800 px-4 py-2.5">
          <span className="h-3 w-3 rounded-full bg-red-500/70" />
          <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
          <span className="h-3 w-3 rounded-full bg-green-500/70" />
          <span className="ml-3 hidden rounded-md bg-dark-900 px-3 py-1 font-mono text-[11px] text-gray-500 sm:block">lubeguard / incident room / C-0412</span>
        </div>
        <div className="grid grid-cols-12 gap-3 p-3 md:p-4">
          <div className="col-span-1 hidden flex-col items-center gap-2 md:flex">
            {[Siren, LayoutDashboard, Ticket, Network].map((I, i) => (
              <div key={i} className={`flex h-10 w-10 items-center justify-center rounded-lg ${i === 0 ? 'bg-accent-cyan text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-dark-800 text-gray-500'}`}>
                <I size={18} />
              </div>
            ))}
          </div>
          <div className="col-span-12 space-y-3 md:col-span-11">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {tiles.map((t) => (
                <div key={t.tag} className="rounded-lg border border-dark-700 bg-dark-800 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{t.label}</span>
                    <t.icon size={14} className="text-accent-cyan" />
                  </div>
                  <div className={`mt-1 font-mono text-lg font-bold ${t.tone}`}>{t.value}</div>
                  <div className="font-mono text-[10px] text-gray-600">{t.tag}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 rounded-lg border border-dark-700 bg-dark-800 p-3 lg:col-span-7">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">PT-104 header pressure, 6 days</span>
                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" /> Static alarm still green
                  </span>
                </div>
                <Sparkline values={pt} className="mt-2 h-28 w-full" />
                <div className="mt-1 flex justify-between font-mono text-[10px] text-gray-500">
                  <span>{pt[0]?.toFixed(2)} barg</span>
                  <span className="text-amber-400">PSL-104 1.2 barg (SITE SETPOINT, synthetic)</span>
                  <span>{pt[pt.length - 1]?.toFixed(2)} barg</span>
                </div>
              </div>
              <div className="col-span-12 space-y-2 lg:col-span-5">
                <div className="rounded-lg border border-indigo-500/30 bg-gradient-to-br from-indigo-900/40 to-dark-800 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                    <Bot size={12} /> AI insight
                  </div>
                  <p className="mt-1 text-xs text-gray-200">
                    Filter loading, but the reservoir level is rising. Material is unverified: one oil sample photo decides it.
                  </p>
                  <div className="mt-2 flex gap-1">
                    <CitationChip id="R-T5" />
                    <CitationChip id="SOP-LO-04 §2" />
                  </div>
                </div>
                <div className="rounded-lg border border-dark-700 bg-dark-800 p-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">4M+1E</div>
                  <div className="grid grid-cols-5 gap-1">
                    {['man', 'machine', 'method', 'material', 'environment'].map((k) => (
                      <div key={k} className="flex flex-col items-center gap-1 rounded-md bg-dark-900 p-1.5">
                        <span className="text-[9px] uppercase text-gray-500">{k.slice(0, 4)}</span>
                        <StatusPill iconOnly verdict={matrix?.[k]?.verdict || { man: 'G', machine: 'NG', method: 'NG', material: 'UNVERIFIED', environment: 'UNVERIFIED' }[k]} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-dark-700 bg-dark-800 p-3">
              <div className="mb-2 text-xs font-bold text-white">Open work orders</div>
              {[
                ['T-1', 'Oil sample photo from reservoir drain', 'Joko, Field Engineer', 'pill-red', 'high'],
                ['T-3', 'Auto-start test P-104B and P-105', 'Joko, Field Engineer', 'pill-red', 'high'],
                ['T-4', 'Isolate cooler E-101A, run on E-101B', 'Mechanical Shift B', 'pill-red', 'high'],
              ].map(([id, title, who, cls, p]) => (
                <div key={id} className="flex items-center gap-3 border-t border-dark-700 py-2 first:border-0">
                  <span className="h-6 w-1 rounded-full bg-red-500/70" />
                  <span className="font-mono text-[11px] text-gray-500">{id}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-gray-200">{title}</span>
                  <span className="hidden text-[11px] text-gray-500 sm:inline">{who}</span>
                  <span className={`pill ${cls} uppercase`}>{p}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { icon: Radar, title: 'Detect', text: 'Per-signal anomaly detection on header pressure, filter dP, level and bearing temperature, before the static alarm trips.' },
  { icon: Camera, title: 'Request evidence', text: 'An Unverified matrix cell becomes a task for the field engineer, with the SOP section and due time.' },
  { icon: WifiOff, title: 'Field check, offline', text: 'Photo and voice note in the turbine basement with no signal. Queued on the phone, synced on reconnect.' },
  { icon: ClipboardCheck, title: 'Approve and assign', text: 'Advisor actions with SOP citations, authority level and timing. One click creates the tickets.' },
  { icon: LineChart, title: 'Verify', text: 'Post-repair sensor data must return to baseline before the case closes as a verified fix.' },
];

const STACK = ['Gemini 3.8 Flash', 'Agent Development Kit', 'Cloud Run', 'BigQuery AI.DETECT_ANOMALIES', 'Firestore', 'Firebase Auth', 'Cloud Storage'];

export default function Landing() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const preview = usePreviewCase();

  async function enterManager() {
    setBusy(true);
    try {
      const s = await api.createSession('manager');
      navigate(`/m/case/${s.caseId || 'C-0412'}`);
    } catch (err) {
      toast.error(`Could not start the demo: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }
  const enterEngineer = () => navigate('/e/join');

  const managerBtn = (className = '') => (
    <button type="button" onClick={enterManager} disabled={busy} className={`inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] active:scale-95 disabled:opacity-60 ${className}`}>
      {busy ? <Loader2 size={18} className="animate-spin" /> : <LayoutDashboard size={18} />}
      Enter as Manager
    </button>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-dark-900 text-white selection:bg-accent-cyan selection:text-black">
      {/* LND-01 navbar */}
      <nav className="sticky top-0 z-40 border-b border-white/5 bg-dark-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:h-20">
          <Link to="/" aria-label="Optiflow LubeGuard">
            <Logo />
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            {[
              ['#product', 'Product'],
              ['#flow', 'How it works'],
              ['#roles', 'Roles'],
              ['#system', 'The system'],
            ].map(([href, label]) => (
              <a key={href} href={href} className="text-sm text-gray-300 hover:text-white">
                {label}
              </a>
            ))}
            <button type="button" onClick={enterManager} disabled={busy} className="btn-primary rounded-control px-4">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              Enter as Manager
            </button>
          </div>
          <button type="button" className="btn-ghost p-2 md:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu">
            {menu ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menu && (
          <div className="border-t border-white/5 bg-dark-900 px-4 pb-4 md:hidden">
            {[
              ['#product', 'Product'],
              ['#flow', 'How it works'],
              ['#roles', 'Roles'],
              ['#system', 'The system'],
            ].map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenu(false)} className="block border-b border-white/5 py-3 text-base text-gray-200">
                {label}
              </a>
            ))}
            <button type="button" onClick={enterManager} className="btn-primary mt-3 w-full py-3">
              Enter as Manager
            </button>
          </div>
        )}
      </nav>

      {/* LND-02 hero */}
      <header className="relative isolate px-4 pb-12 pt-16 text-center md:pt-24">
        <div className="glow-blob left-1/2 top-10 h-[420px] w-[420px] -translate-x-1/2 md:h-[520px] md:w-[520px]" />
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mx-auto max-w-4xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-cyan/20 bg-accent-cyan/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-cyan">
            <Droplets size={12} /> Turbine lube-oil reliability
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-7xl">
            From signal to verified fix,
            <br />
            <span className="text-gradient">for the oil that keeps your turbine alive.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-gray-400 md:text-lg">
            LubeGuard catches a slow header pressure decay early, diagnoses it with a cited 4M+1E matrix, asks the field engineer for one photo when it is unsure, and closes the case only when the sensors prove the fix.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {managerBtn()}
            <button type="button" onClick={enterEngineer} className="inline-flex items-center gap-2 rounded-full border border-dark-600 bg-dark-800 px-6 py-3 text-sm font-bold text-white transition-all hover:border-accent-cyan/60 active:scale-95">
              <Smartphone size={18} /> Enter as Engineer
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500">Each visitor gets a private sandbox. Synthetic demo data.</p>
        </motion.div>
      </header>

      {/* LND-03 product preview */}
      <section id="product" className="px-4 pb-20">
        <Reveal>
          <ProductPreview c={preview} />
        </Reveal>
      </section>

      {/* LND-04 stats band */}
      <section className="border-y border-dark-700 bg-dark-800/50 px-4 py-14">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-2">
          <Reveal className="text-center">
            <div className="font-mono text-4xl font-bold text-white md:text-5xl">US$29,721</div>
            <div className="mt-2 text-sm font-semibold text-gray-200">per hour of downtime</div>
            <div className="mt-1 text-xs text-gray-500">Problem brief: US$67.2M / 2,261 h</div>
          </Reveal>
          <Reveal className="text-center" delay={0.1}>
            <div className="font-mono text-4xl font-bold text-white md:text-5xl">US$1.4T</div>
            <div className="mt-2 text-sm font-semibold text-gray-200">yearly cost of unplanned downtime at the 500 largest companies</div>
            <div className="mt-1 text-xs text-gray-500">Siemens, True Cost of Downtime 2024</div>
          </Reveal>
        </div>
      </section>

      {/* LND-05 value cards */}
      <section className="px-4 py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">It refuses to guess.</h2>
          <p className="mt-4 text-gray-400">Numbers come from code, reasoning from Gemini, and every claim carries a source you can click.</p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: 'Proven', tone: 'cyan', text: 'Every verdict cites a rule, an SOP section or an evidence item. Citations are checked in code; anything unproven stays Unverified.' },
            { icon: DollarSign, title: 'Priced', tone: 'purple', text: 'Exposure is computed by code from similar incidents and the brief cost per hour, with the formula one hover away.' },
            { icon: BadgeCheck, title: 'Verified', tone: 'green', text: 'A case closes only when post-repair header pressure, filter dP and bearing temperature return to their baselines.' },
          ].map((v, i) => (
            <Reveal key={v.title} delay={i * 0.12}>
              <motion.div
                whileHover={{ y: -5, scale: 1.01 }}
                className={`glass-card h-full p-6 ${v.tone === 'cyan' ? 'hover:border-accent-cyan/50' : v.tone === 'purple' ? 'hover:border-accent-purple/50' : 'hover:border-accent-success/50'}`}
              >
                <div className={`inline-flex rounded-xl p-3 ${v.tone === 'cyan' ? 'bg-cyan-900/30 text-accent-cyan' : v.tone === 'purple' ? 'bg-purple-900/30 text-accent-purple' : 'bg-green-900/30 text-accent-success'}`}>
                  <v.icon size={24} />
                </div>
                <h3 className="mt-4 text-xl font-bold">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{v.text}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* LND-06 two roles */}
      <section id="roles" className="bg-gradient-to-b from-dark-900 to-dark-800 px-4 py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">Two roles, one case.</h2>
          <p className="mt-4 text-gray-400">Laptop as Manager, phone as Engineer. Join with a 6-character code or a QR scan.</p>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-6xl gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="card h-full p-6">
              <div className="flex items-center gap-3">
                <LayoutDashboard className="text-accent-cyan" />
                <h3 className="text-xl font-bold">Manager console</h3>
              </div>
              <p className="mt-2 text-sm text-gray-400">Incident Room with the live skid diagram, agent trace, cited matrix, Advisor actions, tickets, notifications, knowledge graph and grounded Ask.</p>
              <div className="mt-5 space-y-2 rounded-card border border-dark-700 bg-dark-900 p-3">
                {[
                  ['Machine', 'NG', 'Filter F-101A loading', ['R-T5']],
                  ['Method', 'NG', 'Auto-start test 47 days old vs 30-day SOP', ['R-T4']],
                  ['Material', 'UNVERIFIED', 'Level rising: something is entering the oil', ['R-T1']],
                ].map(([k, v, e, cites]) => (
                  <div key={k} className="flex flex-wrap items-center gap-2 rounded-control bg-dark-800 px-3 py-2">
                    <span className="w-20 text-xs font-bold">{k}</span>
                    <StatusPill verdict={v} />
                    <span className="min-w-[160px] flex-1 text-xs text-gray-400">{e}</span>
                    {cites.map((c) => (
                      <CitationChip key={c} id={c} />
                    ))}
                    <ProvenanceChip provenance="ai" />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card flex h-full flex-col gap-6 p-6 sm:flex-row">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <Smartphone className="text-accent-cyan" />
                  <h3 className="text-xl font-bold">Offline Engineer app</h3>
                </div>
                <p className="mt-2 text-sm text-gray-400">Installable PWA with SOP checklists, pass, fail and N/A steps, photo and voice evidence, English and Bahasa labels, and a sync queue that survives no signal.</p>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  <li className="flex items-center gap-2">
                    <WifiOff size={16} className="text-amber-400" /> Works in the turbine basement
                  </li>
                  <li className="flex items-center gap-2">
                    <Camera size={16} className="text-accent-cyan" /> Oil photo judged against a light
                  </li>
                  <li className="flex items-center gap-2">
                    <Mic size={16} className="text-blue-400" /> Voice note in Bahasa
                  </li>
                </ul>
              </div>
              <div className="mx-auto w-48 shrink-0 rounded-[2rem] border-4 border-dark-600 bg-dark-950 p-2 shadow-2xl">
                <div className="rounded-[1.4rem] bg-dark-900 p-2">
                  <div className="rounded-lg bg-amber-500/90 px-2 py-1.5 text-[10px] font-bold text-black">Offline: 2 items queued</div>
                  <div className="mt-2 rounded-lg border border-dark-700 bg-dark-800 p-2">
                    <div className="text-[10px] font-bold text-white">Oil sample photo</div>
                    <div className="text-[9px] text-gray-500">TK-01, SOP-LO-04 §2</div>
                    {['Flush drain valve', 'Fill clear bottle', 'Photo against light'].map((s, i) => (
                      <div key={s} className="mt-1.5 flex items-center gap-1.5 text-[9px] text-gray-300">
                        <span className={`h-3 w-3 rounded ${i < 2 ? 'bg-green-500' : 'border border-dark-500'}`} />
                        {s}
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 rounded-lg bg-accent-cyan py-2 text-center text-[10px] font-bold text-black">Take photo</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* LND-07 five steps */}
      <section id="flow" className="px-4 py-20">
        <Reveal className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-black tracking-tight md:text-5xl">Five steps, one verified fix.</h2>
        </Reveal>
        <div className="mx-auto mt-12 grid max-w-6xl gap-4 md:grid-cols-5">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="card relative h-full p-5">
                <span className="absolute right-4 top-4 font-mono text-xs text-dark-500">0{i + 1}</span>
                <s.icon size={22} className="text-accent-cyan" />
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* LND-08 the system we model */}
      <section id="system" className="px-4 pb-20">
        <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <h2 className="text-3xl font-black tracking-tight">The system we model</h2>
            <p className="mt-4 text-sm leading-relaxed text-gray-400">
              Lube-oil console LO-01 for steam turbine ST-01: reservoir, main and standby AC pumps, a DC emergency pump, duplex filter and cooler, PCV-101, header and bearings. PSL-104 below 1.2 barg starts the standby pump; PSLL-104 below 0.8 barg starts the DC pump and trips the turbine (SITE SETPOINTS, synthetic).
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-400">A knowledge graph links components, tags, failure modes, rules, SOP sections and past incidents, so every answer can cite where it came from.</p>
          </Reveal>
          <Reveal className="lg:col-span-3" delay={0.1}>
            <div className="dot-grid rounded-card border border-dark-700 p-3">
              <SkidDiagram caseData={preview} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* LND-09 stack strip and CTA */}
      <section className="border-y border-dark-700 bg-dark-800/40 px-4 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <div className="micro">Built on Google Cloud and Gemini</div>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {STACK.map((s) => (
              <span key={s} className="rounded-full border border-dark-600 bg-dark-900 px-4 py-2 text-sm text-gray-300">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="relative isolate px-4 py-20">
        <div className="glow-blob left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2" />
        <Reveal>
          <div className="glass mx-auto max-w-4xl rounded-[2rem] p-8 text-center md:p-12">
            <h2 className="text-3xl font-black tracking-tight md:text-4xl">Walk the night the oil turned hazy.</h2>
            <p className="mx-auto mt-3 max-w-xl text-gray-400">Open the Manager console on this screen and join as Engineer from your phone with the QR code in the header.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {managerBtn()}
              <button type="button" onClick={enterEngineer} className="inline-flex items-center gap-2 rounded-full border border-dark-600 bg-dark-800 px-6 py-3 text-sm font-bold active:scale-95">
                Enter as Engineer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-dark-700 px-4 py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <Logo />
            <p className="mt-3 text-xs text-gray-500">Optiflow LubeGuard. Theme: Manufacturing: Intelligent Operations and Industrial Efficiency. Built during the Google Cloud AI Builder Cup 2026.</p>
          </div>
          <div className="space-y-2 text-xs text-gray-400">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-white">
              <Github size={14} /> github.com/Inforable/Optiflow
            </a>
            <div className="pill pill-amber">Synthetic demo data</div>
            <p className="max-w-xs text-gray-500">All plant data, incidents and setpoints are synthetic. SITE SETPOINTS are not standards.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
