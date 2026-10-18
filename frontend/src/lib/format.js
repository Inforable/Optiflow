export function fmtUsd(n) {
  if (n == null || Number.isNaN(n)) return '-';
  if (Math.abs(n) >= 1e6) return `US$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `US$${Math.round(n).toLocaleString('en-US')}`;
  return `US$${n}`;
}

export function fmtNum(n, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return '-';
  return Number(n).toFixed(digits);
}

export function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function fmtShortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit' });
}

export function relTime(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const s = Math.round((Date.now() - t) / 1000);
  const abs = Math.abs(s);
  const fut = s < 0;
  let out;
  if (abs < 60) out = `${abs}s`;
  else if (abs < 3600) out = `${Math.round(abs / 60)} min`;
  else if (abs < 86400) out = `${Math.round(abs / 3600)} h`;
  else out = `${Math.round(abs / 86400)} d`;
  return fut ? `in ${out}` : `${out} ago`;
}

export function lastValue(series, tag) {
  const s = series?.[tag];
  if (!s || !s.length) return null;
  return s[s.length - 1][1];
}

export const CATEGORY_LABEL = {
  man: 'Man',
  machine: 'Machine',
  method: 'Method',
  material: 'Material',
  environment: 'Environment',
};

export const STATUS_LABEL = {
  open: 'Open',
  investigating: 'Investigating',
  awaiting_evidence: 'Awaiting evidence',
  action_proposed: 'Action proposed',
  actions_approved: 'Actions approved',
  verified: 'Verified',
  reopened: 'Reopened',
};

export const TICKET_STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In progress',
  on_hold: 'On hold',
  done: 'Done',
  verified: 'Verified',
};

export const TICKET_TYPE_LABEL = {
  evidence_request: 'Evidence request',
  corrective: 'Corrective',
  safety_test: 'Safety test',
};

export const ASSIGNEES = [
  { role: 'engineer', name: 'Joko, Field Engineer' },
  { role: 'mechanical_shift_b', name: 'Mechanical Shift B' },
  { role: 'manager', name: 'Dimas, Maintenance Supervisor' },
];
