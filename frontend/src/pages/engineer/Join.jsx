// Engineer join: code from the URL (QR scan) or typed in; POST /api/demo/join.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Loader2, LogIn, Languages } from 'lucide-react';
import * as api from '../../lib/api';
import { getSession } from '../../lib/session';
import { useLang } from '../../lib/i18n';
import { MODE } from '../../lib/config';
import Logo from '../../components/Logo';
import { SyntheticNote } from '../../components/ui';

export default function Join() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang, setLang } = useLang();
  const urlCode = (params.get('code') || '').toUpperCase();
  const [code, setCode] = useState(urlCode || (MODE === 'fixtures' ? '7KQ2PX' : ''));
  const [busy, setBusy] = useState(false);
  const tried = useRef(false);

  async function join(c = code) {
    const clean = c.trim().toUpperCase();
    if (clean.length < 4) {
      toast.error('Enter the 6-character code from the Manager screen');
      return;
    }
    setBusy(true);
    try {
      await api.joinSandbox(clean);
      toast.success('Joined as Joko, Field Engineer');
      navigate('/e/tasks', { replace: true });
    } catch (err) {
      toast.error(`Could not join: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!urlCode || tried.current) return;
    tried.current = true;
    const existing = getSession('engineer');
    if (existing?.code === urlCode && existing.sandboxId) navigate('/e/tasks', { replace: true });
    else join(urlCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlCode]);

  return (
    <div className="relative isolate mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="glow-blob left-1/2 top-24 h-72 w-72 -translate-x-1/2" />
      <div className="flex items-center justify-between">
        <Logo />
        <button type="button" onClick={() => setLang(lang === 'en' ? 'id' : 'en')} className="inline-flex h-12 min-w-[48px] items-center justify-center gap-1 rounded-control border border-dark-600 bg-dark-800 px-3 text-xs font-bold" aria-label="Switch label language">
          <Languages size={16} /> {lang === 'en' ? 'EN' : 'ID'}
        </button>
      </div>
      <h1 className="mt-10 text-3xl font-bold">{t('join')}</h1>
      <p className="mt-2 text-base text-gray-400">Scan the QR code on the Manager screen, or type the join code.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          join();
        }}
      >
        <label className="label" htmlFor="code">
          {t('joinCode')}
        </label>
        <input
          id="code"
          className="input h-16 text-center font-mono text-3xl font-bold uppercase tracking-[0.4em]"
          maxLength={8}
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="7KQ2PX"
        />
        <button type="submit" className="btn-primary h-14 w-full text-lg" disabled={busy}>
          {busy ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />} {t('joinBtn')}
        </button>
      </form>
      {MODE === 'fixtures' && <p className="mt-4 text-center text-xs text-gray-500">Fixture mode: any code joins the local demo sandbox.</p>}
      <Link to="/" className="mt-8 text-center text-sm text-gray-500 hover:text-white">
        Back to the landing page
      </Link>
      <SyntheticNote className="mt-6" />
    </div>
  );
}
