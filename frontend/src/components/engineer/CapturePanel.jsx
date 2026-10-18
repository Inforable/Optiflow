// Evidence capture inside a task: camera photo, voice note (MediaRecorder) and sample buttons.
// Every item goes into the IndexedDB offline queue first and syncs when online.
import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Mic, Square, ImagePlus, AudioLines, RotateCw, Trash2, Image as ImageIcon } from 'lucide-react';
import { enqueueEvidence, retryItem, removeItem } from '../../lib/offlineQueue';
import { useQueue } from '../../hooks/useData';
import { useLang } from '../../lib/i18n';
import { SAMPLE_MEDIA } from '../../lib/samples';
import { ItemState } from './SyncStatus';
import { StatusPill } from '../ui';

async function compressImage(file, maxSide = 1600) {
  try {
    if (!file.type.startsWith('image/') || file.type.includes('svg')) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return '';
}

function Thumb({ item }) {
  const url = useMemo(() => {
    if (item.meta?.sample) return SAMPLE_MEDIA[item.meta.sample]?.url || null;
    if (item.blob && item.meta?.kind === 'photo') return URL.createObjectURL(item.blob);
    return null;
  }, [item.id, item.blob, item.meta?.sample, item.meta?.kind]);
  useEffect(
    () => () => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    },
    [url],
  );
  if (item.meta?.kind === 'voice')
    return (
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-dark-700 bg-dark-900">
        <AudioLines size={22} className="text-blue-400" />
      </div>
    );
  return url ? (
    <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-control border border-dark-700 object-cover" />
  ) : (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-dark-700 bg-dark-900">
      <ImageIcon size={22} className="text-gray-500" />
    </div>
  );
}

export default function CapturePanel({ session, ticket }) {
  const { t, lang } = useLang();
  const { items } = useQueue();
  const fileRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState('');

  const mine = items.filter((i) => i.type === 'evidence' && i.meta?.ticketId === ticket.id);
  const meta = (kind, extra = {}) => ({
    sandboxId: session.sandboxId,
    caseId: ticket.caseId,
    ticketId: ticket.id,
    kind,
    note: note.trim() || null,
    ...extra,
  });

  useEffect(() => {
    if (!recording) return undefined;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  useEffect(
    () => () => {
      try {
        recRef.current?.stream?.getTracks().forEach((tr) => tr.stop());
      } catch {
        /* ignore */
      }
    },
    [],
  );

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const blob = await compressImage(file);
    await enqueueEvidence(meta('photo'), blob);
    setNote('');
    toast.success(navigator.onLine ? 'Photo saved, uploading' : 'Saved offline, photo queued');
  }

  async function startRec() {
    const mime = pickMime();
    if (mime === null || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice recording is not supported in this browser. Use the sample voice note.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data?.size && chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || mime || 'audio/webm' });
        if (blob.size) {
          await enqueueEvidence(meta('voice'), blob);
          setNote('');
          toast.success(navigator.onLine ? 'Voice note saved, uploading' : 'Saved offline, voice note queued');
        }
      };
      rec.start();
      recRef.current = rec;
      setSeconds(0);
      setRecording(true);
    } catch (err) {
      toast.error(`Microphone unavailable: ${err.message}`);
    }
  }

  function stopRec() {
    try {
      recRef.current?.stop();
    } catch {
      /* ignore */
    }
    setRecording(false);
  }

  async function sendSample(key) {
    const s = SAMPLE_MEDIA[key];
    await enqueueEvidence(meta(s.kind, { sample: key }), null);
    toast.success(navigator.onLine ? 'Sample sent' : 'Saved offline, sample queued');
  }

  return (
    <div className="space-y-3">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhoto} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => fileRef.current?.click()} className="btn-primary min-h-[64px] flex-col gap-1 text-base">
          <Camera size={24} /> {t('takePhoto')}
        </button>
        {recording ? (
          <button type="button" onClick={stopRec} className="btn-danger min-h-[64px] flex-col gap-1 text-base">
            <Square size={22} className="animate-pulse" /> {t('stopRecording')} {seconds}s
          </button>
        ) : (
          <button type="button" onClick={startRec} className="btn-secondary min-h-[64px] flex-col gap-1 text-base">
            <Mic size={24} /> {t('recordVoice')}
          </button>
        )}
      </div>
      <input className="input min-h-[48px] text-base" placeholder={`${t('note')} (optional)`} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="space-y-2 rounded-card border border-dashed border-dark-600 p-3">
        <div className="micro">For judges without an oil sample</div>
        {Object.entries(SAMPLE_MEDIA).map(([key, s]) => (
          <button key={key} type="button" onClick={() => sendSample(key)} className="btn-secondary min-h-[48px] w-full justify-start text-sm">
            {s.kind === 'voice' ? <AudioLines size={18} className="text-blue-400" /> : <ImagePlus size={18} className="text-accent-cyan" />}
            {lang === 'id' ? s.labelId : s.label}
          </button>
        ))}
      </div>
      {mine.length > 0 && (
        <div className="space-y-2">
          <div className="micro">{t('queue')}</div>
          {[...mine].reverse().map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-card border border-dark-700 bg-dark-800 p-2.5">
              <Thumb item={it} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-semibold capitalize">{it.meta.sample ? `${it.meta.kind} (sample)` : it.meta.kind}</span>
                  <ItemState state={it.state} />
                  {it.result?.verdict ? <StatusPill verdict={it.result.verdict} /> : null}
                </div>
                {it.result?.finding ? <div className="mt-0.5 text-xs text-gray-400">{it.result.finding}</div> : null}
                {it.error ? <div className="mt-0.5 text-xs text-red-400">{it.error}</div> : null}
              </div>
              {it.state === 'failed' && (
                <button type="button" className="btn-secondary h-12 w-12 p-0" onClick={() => retryItem(it.id)} aria-label="Retry upload">
                  <RotateCw size={18} />
                </button>
              )}
              {(it.state === 'failed' || it.state === 'synced') && (
                <button type="button" className="btn-ghost h-12 w-12 p-0" onClick={() => removeItem(it.id)} aria-label="Remove from list">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
