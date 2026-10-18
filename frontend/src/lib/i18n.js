// English default with a Bahasa Indonesia label toggle for the Engineer app (ENG-08).
import { useEffect, useState } from 'react';

const KEY = 'optiflow.lang';
const DICT = {
  tasks: ['Tasks', 'Tugas'],
  capture: ['Capture', 'Ambil bukti'],
  alerts: ['Alerts', 'Notifikasi'],
  myTasks: ['My tasks', 'Tugas saya'],
  noTasks: ['No tasks assigned yet. New tasks appear here automatically.', 'Belum ada tugas. Tugas baru muncul otomatis di sini.'],
  steps: ['steps', 'langkah'],
  due: ['Due', 'Batas'],
  priority: ['Priority', 'Prioritas'],
  checklist: ['Checklist', 'Daftar periksa'],
  pass: ['Pass', 'Lulus'],
  fail: ['Fail', 'Gagal'],
  na: ['N/A', 'T/A'],
  note: ['Note', 'Catatan'],
  reading: ['Reading', 'Pembacaan'],
  evidence: ['Evidence', 'Bukti'],
  takePhoto: ['Take photo', 'Ambil foto'],
  recordVoice: ['Record voice note', 'Rekam catatan suara'],
  stopRecording: ['Stop recording', 'Berhenti merekam'],
  submitReport: ['Submit report', 'Kirim laporan'],
  summary: ['Findings summary', 'Ringkasan temuan'],
  condition: ['Condition', 'Kondisi'],
  good: ['Good', 'Baik'],
  fair: ['Fair', 'Cukup'],
  poor: ['Poor', 'Buruk'],
  offline: ['Offline', 'Offline'],
  itemsQueued: ['items queued', 'item antre'],
  allSynced: ['All synced', 'Semua tersinkron'],
  join: ['Join the demo', 'Gabung demo'],
  joinCode: ['Join code', 'Kode gabung'],
  joinBtn: ['Join as Engineer', 'Gabung sebagai Teknisi'],
  safety: ['Safety', 'Keselamatan'],
  queue: ['Sync queue', 'Antrean sinkron'],
  pickTask: ['Pick a task to attach evidence to', 'Pilih tugas untuk melampirkan bukti'],
  instruction: ['Instruction', 'Instruksi'],
  noAlerts: ['No alerts yet.', 'Belum ada notifikasi.'],
  back: ['Back', 'Kembali'],
  saved: ['Saved', 'Tersimpan'],
  reportSent: ['Report submitted', 'Laporan terkirim'],
  done: ['Done', 'Selesai'],
};

const listeners = new Set();

function readLang() {
  try {
    return localStorage.getItem(KEY) === 'id' ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(lang));
}

export function useLang() {
  const [lang, setLocal] = useState(readLang);
  useEffect(() => {
    listeners.add(setLocal);
    return () => listeners.delete(setLocal);
  }, []);
  const t = (key) => {
    const e = DICT[key];
    if (!e) return key;
    return lang === 'id' ? e[1] : e[0];
  };
  return { lang, setLang, t };
}
