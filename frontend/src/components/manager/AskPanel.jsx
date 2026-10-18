// Ask LubeGuard: grounded answers with citation chips; refusals shown as "0 sources, answer refused".
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Bot, Send, ShieldOff, User, Sparkles } from 'lucide-react';
import * as api from '../../lib/api';
import { CitationChip, Spinner } from '../ui';

const SUGGESTED = ['Why is the filter loading?', 'What does SOP-LO-05 say about the auto-start test?', 'Who won the World Cup?'];

export default function AskPanel({ session, caseId, onCite, className = '', heightClass = 'h-[460px]' }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  async function send(q) {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    setText('');
    setMessages((m) => [...m, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const res = await api.ask(session?.sandboxId, question, caseId);
      setMessages((m) => [...m, { role: 'ai', text: res.answer, citations: res.citations || [], refused: res.refused }]);
    } catch (err) {
      setMessages((m) => [...m, { role: 'ai', text: `Could not reach Ask: ${err.message}`, citations: [], error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col ${heightClass} ${className}`}>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-card bg-gradient-to-b from-dark-800 to-dark-900 p-3">
        {!messages.length && (
          <div className="space-y-3 p-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles size={16} className="text-accent-purple" /> Ask LubeGuard
            </div>
            <p className="text-xs text-gray-400">Answers come only from this plant&apos;s knowledge graph and SOP sections, with citations. Anything else is refused.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${m.role === 'user' ? 'bg-blue-900/40 text-blue-300' : 'bg-purple-900/40 text-purple-300'}`}>
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'rounded-tr-none bg-accent-cyan/15 text-cyan-50 border border-cyan-900/40'
                  : m.refused
                    ? 'rounded-tl-none border border-amber-800/50 bg-amber-950/30 text-amber-100'
                    : 'rounded-tl-none border border-dark-700 bg-dark-800 text-gray-200'
              }`}
            >
              {m.refused && (
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-400">
                  <ShieldOff size={12} /> 0 sources, answer refused
                </div>
              )}
              <p>{m.refused ? m.text.replace(/^0 sources, answer refused\.?\s*/i, '') || 'Out of scope for this plant.' : m.text}</p>
              {m.role === 'ai' && !m.refused && m.citations?.length ? (
                <div className="mt-2 flex flex-wrap gap-1 border-t border-dark-700 pt-2">
                  <span className="micro mr-1 self-center">{m.citations.length} sources</span>
                  {m.citations.map((c) => (
                    <CitationChip key={c.id} id={c.id} type={c.type} label={c.label} onClick={onCite} />
                  ))}
                </div>
              ) : null}
            </div>
          </motion.div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-accent-purple">
            <Spinner size={14} /> Retrieving graph nodes and SOP sections...
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SUGGESTED.map((s) => (
          <button key={s} type="button" onClick={() => send(s)} disabled={busy} className="pill pill-purple hover:brightness-125 disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input className="input" placeholder="Ask about this lube-oil system..." value={text} onChange={(e) => setText(e.target.value)} aria-label="Question" />
        <button type="submit" className="btn-primary px-3" disabled={busy || !text.trim()} aria-label="Send question">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
