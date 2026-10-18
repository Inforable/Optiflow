// Agent trace: one entry per tool call or human event, newest entries animate in.
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { ProvenanceChip, EmptyState } from '../ui';
import { fmtTime } from '../../lib/format';

const STEP_LABEL = (s) => s.replace(/_/g, ' ');

export default function TraceTimeline({ trace = [], running = false }) {
  if (!trace.length) return <EmptyState icon={Activity} title="No trace yet">Run the investigation to see each tool call.</EmptyState>;
  return (
    <ol className="relative space-y-3 pl-5">
      <span className="absolute left-[7px] top-1 bottom-1 w-px bg-dark-700" aria-hidden />
        {trace.map((t, i) => {
          const human = t.provenance === 'human';
          const last = i === trace.length - 1;
          return (
            <motion.li
              key={`${t.at}-${t.step}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              <span
                className={`absolute -left-5 top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                  human ? 'border-blue-400 bg-blue-900/60' : 'border-accent-purple bg-purple-900/60'
                } ${last && running ? 'animate-pulse' : ''}`}
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-gray-500">{fmtTime(t.at)}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">{STEP_LABEL(t.step)}</span>
                <ProvenanceChip provenance={t.provenance} />
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{t.summary}</p>
            </motion.li>
          );
        })}
      {running && (
        <li className="relative flex items-center gap-2 text-xs text-accent-purple">
          <span className="absolute -left-5 top-0.5 h-3.5 w-3.5 animate-ping rounded-full bg-accent-purple/40" aria-hidden />
          Agent working...
        </li>
      )}
    </ol>
  );
}
