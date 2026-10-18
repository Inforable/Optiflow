// 4M+1E matrix: Man, Machine, Method, Material, Environment with verdict, evidence,
// citation chips and provenance. Unverified cells offer "Send evidence request".
import { motion } from 'framer-motion';
import { Send, CheckCircle2, Loader2 } from 'lucide-react';
import { StatusPill, ProvenanceChip, CitationChip, Skeleton } from '../ui';
import { CATEGORY_LABEL } from '../../lib/format';

const ORDER = ['man', 'machine', 'method', 'material', 'environment'];
const BORDER = { G: 'border-green-900/40', NG: 'border-red-800/60', UNVERIFIED: 'border-amber-700/60' };

export default function MatrixGrid({ matrix, evidenceRequests = [], onRequest, requesting, onCite }) {
  if (!matrix) {
    return (
      <div className="space-y-2">
        {ORDER.map((k) => (
          <Skeleton key={k} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {ORDER.map((key) => {
        const cell = matrix[key];
        if (!cell) return null;
        const req = evidenceRequests.find((r) => r.category === key);
        const sent = Boolean(req?.ticketId);
        return (
          <motion.div
            key={`${key}-${cell.verdict}`}
            initial={{ opacity: 0.4, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`rounded-card border bg-dark-900/60 p-3 ${BORDER[cell.verdict] || 'border-dark-700'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{CATEGORY_LABEL[key]}</span>
                <StatusPill verdict={cell.verdict} />
              </div>
              <ProvenanceChip provenance={cell.provenance} />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-300">{cell.evidence}</p>
            {cell.citations?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {cell.citations.map((c) => (
                  <CitationChip key={c} id={c} onClick={onCite} />
                ))}
              </div>
            ) : null}
            {cell.verdict === 'UNVERIFIED' && onRequest ? (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-dark-700 pt-2.5">
                {sent ? (
                  <span className="pill pill-green">
                    <CheckCircle2 size={12} /> Request sent: {req.ticketId}
                  </span>
                ) : (
                  <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => onRequest(key)} disabled={requesting === key}>
                    {requesting === key ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Send evidence request
                  </button>
                )}
                {req ? <span className="text-[11px] text-gray-500">{req.sopRef}</span> : null}
              </div>
            ) : null}
          </motion.div>
        );
      })}
    </div>
  );
}
