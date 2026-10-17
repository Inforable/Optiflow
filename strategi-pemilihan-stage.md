# Optiflow: Strategi Pemilihan Stage Berdasarkan Kriteria Penilaian

> Subtema: **Manufacturing & Industrial Operations** (efficiency, quality, reliability, supply-demand, sustainability).
> Dokumen ini memilih stage dari [pipeline-mapping-gcp-repo.md](pipeline-mapping-gcp-repo.md) yang paling menaikkan skor, lalu mengusulkan stage baru yang belum ada.
> Skor di bawah adalah penilaian awal, jadi perlu didiskusikan ulang bersama tim.

---

## 1. Membaca Kriteria Penilaian

| Kriteria | Bobot | Yang dicari juri | Implikasi ke pemilihan stage |
|---|---|---|---|
| **Technical Merit & Gen AI Implementation** | 40% | Gen AI dipakai secara substansial (reasoning, tool use, grounding, multimodal), bukan sekadar chatbot; arsitektur yang solid | Prioritaskan stage dengan **Gen AI yang benar-benar bekerja** (agent yang query data, RAG bersitasi, multimodal, structured output) **ditambah ML prediktif** |
| **Problem Alignment & Impact** | 25% | Cocok dengan problem statement (insight, recommendation, action dari data operasional); dampaknya terukur | Prioritaskan stage yang **menghasilkan angka** (US$, jam downtime, MTTR) dan yang masuk "Suggested Solution Directions" (**predictive maintenance**, **operational copilot**) |
| **Innovation & Creativity** | 25% | Sudut pandang yang tidak dimiliki peserta lain | Prioritaskan stage yang **gap open-source-nya besar**: Loss real-time, RCA 4M+1E G/NG, Impact × Control |
| **User Experience & Solution Design** | 10% | Intuitif, accessible, dan semua komponen (termasuk Gen AI) terasa satu alur | Satukan semua stage ke **satu layar "Incident Room"** + kanal mobile/chat untuk teknisi |

**Kesimpulan:** 65% nilai (Technical + Innovation) ada di **layer Detection → Diagnosis → Action**. Layer Data Foundation (ingest, governance, KPI) penting, tapi cukup dibuat "secukupnya tapi kredibel", karena juri jarang memberi nilai tinggi pada ETL.

---

## 2. Skoring 15 Stage (Weighted)

Skala 1–5 per kriteria. Skor akhir = 0.40·T + 0.25·P + 0.25·I + 0.10·U.

| # | Stage | T (40%) | P (25%) | I (25%) | U (10%) | **Skor** | Keputusan |
|---|---|:-:|:-:|:-:|:-:|:-:|---|
| 10 | Root Cause Verification (4M+1E G/NG) | 5 | 4 | 5 | 3 | **4.55** | ✅ CORE |
| 7 | Condition Monitoring (multivariat) | 5 | 5 | 3 | 3 | **4.30** | ✅ CORE |
| 8 | Failure Early Detection (P-F / RUL) | 5 | 5 | 3 | 3 | **4.30** | ✅ CORE (digabung dengan 7) |
| 9 | Historical Knowledge (RAG incident + CAPA) | 5 | 4 | 3 | 4 | **4.15** | ✅ CORE |
| 11 | Alert Prioritization (alarm flood) | 4 | 4 | 4 | 4 | **4.00** | ✅ CORE-LITE (momen "wow" kedua) |
| 12 | Action Assessment (Impact × Control) | 4 | 3 | 5 | 3 | **3.90** | ✅ CORE |
| 13 | Action Guidance (SOP bersitasi) | 4 | 4 | 3 | 5 | **3.85** | ✅ CORE (digabung dengan 12) |
| 5 | Loss Quantification (US$/menit live) | 2 | 5 | 4 | 4 | **3.45** | ✅ WAJIB: murah, impact-nya paling kelihatan |
| 2 | Data Quality (flatline/drift) | 4 | 3 | 3 | 2 | **3.30** | 🟡 ENABLER: dibuat sebagai "trust gate" |
| 4 | Asset Taxonomy (tag ↔ equipment) | 3 | 3 | 3 | 2 | **2.90** | 🟡 ENABLER: Gemini entity resolution |
| 15 | Action Tracking (Problem Tank) | 2 | 4 | 2 | 4 | **2.70** | 🟡 LITE: penutup loop |
| 6 | Operational Visibility | 2 | 3 | 2 | 5 | **2.55** | 🔵 Dilebur jadi UI utama, bukan modul sendiri |
| 14 | Action Ownership (RACI) | 2 | 3 | 2 | 3 | **2.35** | 🔵 Rule sederhana di dalam stage 15 |
| 1 | Data Ingestion | 3 | 3 | 1 | 1 | **2.30** | 🔵 Fondasi minimal (simulator → Pub/Sub → BigQuery) |
| 3 | KPI & Relational Mapping | 2 | 3 | 2 | 2 | **2.25** | ❌ Skip: masalah organisasi, sulit didemokan |

**Alasan singkat untuk yang di-skip/dilebur:**
- **Stage 3 (KPI harmonization)** pada dasarnya masalah tata kelola antar-departemen. Demonya hanya tabel definisi dan Gen AI-nya tipis. Cukup sebut "satu definisi KPI di BigQuery view" di arsitektur.
- **Stage 6 (Visibility)** tidak perlu jadi modul sendiri, karena UI Incident Room dan dashboard loss sudah memenuhinya.
- **Stage 14 (Ownership)** cukup tabel RACI + rule `asset_class × failure_mode × shift → PIC`. Tidak perlu workflow engine.

---

## 3. Stage Baru yang Direkomendasikan (Belum Ada di 15 Stage)

15 stage yang ada **belum menyentuh beberapa hal yang justru disebut eksplisit di problem statement**: tidak ada Vision/image, tidak ada optimasi produksi, tidak ada sustainability, dan loop-nya berhenti di "Closed" tanpa verifikasi.

### 🆕 N1 — Multimodal Field Evidence (P0, sangat disarankan)
**Masalah:** RCA dan konfirmasi anomali hanya mengandalkan sensor. Padahal teknisi lapangan punya bukti fisik: foto seal bocor, warna oli, termal, suara kavitasi.

**Solusi:** Teknisi memotret, merekam suara, atau merekam video singkat dari HP, yang disimpan di **Cloud Storage**. **Gemini multimodal** menilai bukti terhadap kriteria NG (misalnya "oli keruh → kontaminasi, Material NG"; "suara krepitasi → kavitasi, Method NG"). Hasilnya masuk sebagai evidence di matriks 4M+1E (Stage 10).

**Kenapa menaikkan skor:**
- **Technical (40%):** multimodal reasoning (image + audio + time-series) adalah pemakaian Gen AI yang paling "dalam".
- **Alignment (25%):** menutup arahan *visual quality inspection* dan teknologi yang disarankan (**Vision AI, Cloud Storage**). Tanpa stage ini, dua teknologi tersebut tidak terpakai.
- **UX (10%):** teknisi cukup foto, tanpa mengisi form.

### 🆕 N2 — Intervention Window Optimizer (P1, diferensiasi utama)
**Masalah:** setelah tahu "bearing akan gagal dalam 9–14 hari", tim tetap harus memutuskan **kapan** intervensi: sekarang (stop line 4 jam), saat planned shutdown minggu depan, atau run-to-failure?

**Solusi:** Gabungkan **RUL dari Stage 8** + **loss rate dari Stage 5** + jadwal produksi + ketersediaan spare part/teknisi. Optimasi sederhana (ekspektasi biaya per opsi; bisa dengan OR-Tools di **Cloud Run**) menghasilkan rekomendasi seperti: "Intervensi Kamis 22:00 saat changeover. Expected cost US$18k vs US$535k jika run-to-failure (18 jam × US$29,721)."

**Kenapa menaikkan skor:**
- **Innovation (25%):** jarang ada yang menyambungkan P-F curve dengan ekonomi intervensi. Kebanyakan solusi PdM berhenti di "alert".
- **Alignment:** masuk arahan *production optimization* sekaligus *predictive maintenance*.
- Gemini menjelaskan trade-off dalam bahasa manajer (explainable recommendation).

### 🆕 N3 — Fix Effectiveness Verification & Learning Loop (P1)
**Masalah:** Stage 15 berhenti di "Closed". Tidak ada yang memverifikasi apakah perbaikan **benar-benar berhasil**, padahal inilah sumber recurring incident.

**Solusi:** Setelah tiket closed, sistem memantau sinyal yang sama selama N jam/hari. Kalau vibrasi kembali ke baseline, CAPA ditandai **Effective** dan otomatis diindeks ke knowledge base (Stage 9) dengan label "solusi terverifikasi". Kalau tidak, tiket otomatis dibuka ulang. Label ini juga menjadi **data training** untuk model anomali/RUL (human feedback loop).

**Kenapa menaikkan skor:**
- **Technical:** menunjukkan sistem yang belajar (closed-loop MLOps), bukan pipeline satu arah.
- **Innovation:** "evidence-based closure" adalah konsep yang kuat untuk dipitch.
- **Alignment:** langsung menjawab dampak "recurring incident" di Stage 15.

### 🆕 N4 — Energy & Carbon Cost of Degradation (P1, murah karena menempel ke Stage 5)
**Masalah:** aset yang terdegradasi (heat exchanger fouling, pompa misaligned, kompresor bocor) **membakar energi lebih banyak** sebelum gagal. Biaya ini tidak terlihat di laporan reliability.

**Solusi:** Loss meter di Stage 5 diperluas jadi tiga dimensi, yaitu **US$ + kWh + tCO₂e**. Contoh: "Fouling HE-301 menambah 340 kWh/hari ≈ 0,27 tCO₂e/hari."

**Kenapa menaikkan skor:** menyentuh pilar **sustainability** dari subtema dengan usaha kecil (hanya formula tambahan di BigQuery), dan memperluas narasi impact.

### 🆕 N5 — Shift Handover Copilot (P2)
**Masalah:** contoh di Stage 14 ("kavitasi tercatat di shift report tapi tidak ada PIC") menunjukkan bahwa **masalah tersembunyi di teks bebas shift log**.

**Solusi:** Gemini membaca shift log (teks atau voice note), mengekstrak issue yang belum ber-tiket, lalu membuat ringkasan handover otomatis: "3 isu aktif, 1 tanpa PIC, 2 anomali sensor yang perlu dipantau shift berikutnya."

**Kenapa menaikkan skor:** masuk arahan *operational copilot*, UX-nya natural (voice, Bahasa Indonesia), dan menambah satu sumber data tak terstruktur.

### 🆕 N6 — AI Trust Layer: Guardrails & Evaluation (lintas stage, P0 tapi ringan)
**Masalah:** di lingkungan process safety, rekomendasi AI yang salah berbahaya. Juri teknikal hampir pasti bertanya "bagaimana kalau Gemini halusinasi?"

**Solusi:**
- Setiap rekomendasi **wajib bersitasi** (nomor SOP, ID incident, query BigQuery yang dipakai).
- **Human-in-the-loop**: aksi yang menyentuh safety atau butuh stop line harus di-approve dulu.
- **Confidence + reason**: agent menulis alasan dan tingkat keyakinan.
- **Evaluasi**: siapkan 20–30 skenario uji (golden set) dan ukur dengan **Gen AI Evaluation Service di Vertex AI** / ADK eval: groundedness, akurasi klasifikasi 4M+1E, dan ketepatan SOP.

**Kenapa menaikkan skor:** angka evaluasi di slide ("groundedness 0.92, RCA accuracy 85% di 30 skenario") adalah pembeda besar di kriteria Technical Merit.

### Ringkasan stage baru

| Stage baru | T | P | I | U | Skor | Prioritas |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| N1 Multimodal Field Evidence | 5 | 4 | 4 | 4 | **4.40** | P0 |
| N2 Intervention Window Optimizer | 4 | 5 | 5 | 3 | **4.40** | P1 |
| N3 Fix Effectiveness & Learning Loop | 4 | 4 | 4 | 3 | **3.90** | P1 |
| N6 AI Trust Layer & Evaluation | 5 | 3 | 3 | 3 | **3.80** | P0 (ringan) |
| N5 Shift Handover Copilot | 4 | 3 | 3 | 4 | **3.50** | P2 |
| N4 Energy & Carbon Cost | 2 | 4 | 3 | 3 | **2.85** | P1 (murah) |

---

## 4. Scope Final yang Direkomendasikan

Semua stage terpilih dikelompokkan jadi **5 modul agent** agar terlihat kohesif (penting untuk UX "Experience & integration"):

| Modul (agent) | Stage yang dicakup | Peran | Prioritas |
|---|---|---|---|
| **① Sentinel**: deteksi dini | 2 (trust gate), 7, 8, 11 | Deteksi anomali multivariat + RUL, memastikan bukan sensor drift, mengelompokkan alarm flood | P0 (11 = P1) |
| **② Ledger**: dampak | 5 + N4 | Exposure US$/menit, kWh, tCO₂e, live | P0 |
| **③ Investigator**: diagnosis | 9, 10, N1, 4 (entity resolution) | Incident mirip + matriks 4M+1E G/NG dari sensor + foto/suara lapangan | P0 |
| **④ Advisor**: keputusan | 12, 13, N2 | Impact × Control, kapan intervensi, langkah SOP bersitasi | P0 (N2 = P1) |
| **⑤ Closer**: eksekusi | 14, 15, N3 | Auto-PIC, tiket Problem Tank, verifikasi efektivitas, knowledge ditulis balik | P0-lite (N3 = P1) |
| **Trust Layer** | N6 | Sitasi, HITL approval, evaluasi | P0 |

**Tidak dibangun (cukup disebut di arsitektur target):** Stage 1 penuh (Manufacturing Connect/MDE), Stage 3 KPI harmonization, Stage 6 executive multi-level, N5 Shift Handover (kalau waktu tersisa).

### Urutan pengerjaan
1. **P0 (wajib ada di demo):** simulator data → Pub/Sub → Dataflow → BigQuery; Sentinel (7/8 + DQ gate); Ledger (5); Investigator (9, 10, N1); Advisor (12, 13); Closer-lite (tiket + PIC); Trust Layer (sitasi + approval + golden set kecil).
2. **P1 (menaikkan skor Innovation):** N2 Intervention Window, N3 Fix Verification, Stage 11 Alarm Flood Triage, N4 Energy/CO₂.
3. **P2 (bonus):** N5 Shift Handover, Stage 4 graph penuh, dashboard eksekutif.

---

## 5. Pemetaan ke Teknologi yang Disarankan Panitia

Pastikan **semua teknologi di daftar panitia terpakai secara bermakna**, karena juri biasanya mengecek ini.

| Teknologi (daftar panitia) | Dipakai di | Fungsi konkret |
|---|---|---|
| **Gemini on Vertex AI** | Investigator, Advisor, Sentinel (11), Trust Layer | Reasoning RCA 4M+1E, multimodal (N1), structured output Impact × Control, grouping alarm, penjelasan rekomendasi |
| **Vertex AI** (ML) | Sentinel (8), N3 | Model RUL/health index, retraining dari label efektivitas, Gen AI Evaluation Service |
| **BigQuery** | Semua | Data sensor + work order + incident; `AI.DETECT_ANOMALIES`/TimesFM; Vector Search untuk incident mirip; formula loss/kWh/CO₂ |
| **Cloud Storage** | N1, Stage 9 | Foto/audio/video lapangan, PDF investigasi & SOP |
| **Vision AI / image analysis** | N1 | Analisis foto komponen (Gemini multimodal; opsional Vision API untuk OCR label/nameplate aset) |
| **Pub/Sub** | Sentinel, Closer | Stream sensor dari simulator; event `anomaly.confirmed`, `ticket.closed` |
| **Dataflow** | Pipeline | Validasi DQ inline (flatline/range/timestamp), enrichment konteks aset, kalkulasi loss rate streaming |
| **Cloud Run** | Semua agent + UI | Hosting ADK agents, optimizer N2, web app Incident Room |

Tambahan yang memperkuat Technical Merit: **ADK** (multi-agent), **Vertex AI Search** (grounding SOP & CAPA), **MCP Toolbox for Databases** (agent ↔ BigQuery), dan **Agent Runtime** (dulu bernama Vertex AI Agent Engine, sekarang bagian dari Gemini Enterprise Agent Platform) untuk deploy agent.

---

## 6. Bagaimana Tiap Kriteria Dimaksimalkan

### Technical Merit & Gen AI (40%)
- **Multi-agent nyata** (5 agent dengan peran jelas, dikoordinasi orchestrator), bukan satu prompt besar.
- **Gen AI di 5 bentuk berbeda:** (1) tool calling ke BigQuery, (2) RAG bersitasi (SOP/CAPA), (3) multimodal (foto/suara), (4) structured output (matriks G/NG, Impact × Control), (5) ringkasan/penjelasan untuk manusia.
- **Gen AI + ML klasik saling melengkapi:** ML untuk deteksi dan prediksi, Gen AI untuk diagnosis, reasoning, dan aksi. Ini narasi arsitektur yang matang.
- **Evaluasi terukur** (N6): tampilkan angka di slide.

### Problem Alignment & Impact (25%)
- Tepat di dua arahan panitia: **predictive maintenance** dan **operational copilot**, ditambah *production optimization* (N2), *visual inspection* (N1), dan *sustainability* (N4).
- Angka impact dari data kasus: **US$67.2M / 2,261 jam → US$29,721/jam**. Klaim yang bisa dipertahankan, misalnya: "Kalau 20% downtime bisa dicegah lewat deteksi dini → ~452 jam → ~US$13.4M/tahun." Tulis asumsinya di slide.
- Metrik operasional: waktu deteksi (hari sebelum F), MTTR (investigasi dari hari menjadi menit), dan alarm yang perlu dibaca operator (40 → 1–3).

### Innovation & Creativity (25%)
Tiga hal yang hampir tidak dimiliki peserta lain (gap open-source-nya terbukti, lihat file mapping):
1. **Evidence-based 4M+1E**: sensor + foto lapangan menjadi verdict G/NG per kategori, mengakhiri debat subjektif.
2. **Ekonomi intervensi**: P-F curve × US$/menit menghasilkan "kapan sebaiknya diperbaiki", bukan sekadar "akan rusak".
3. **Closure berbasis bukti**: tiket baru dianggap selesai setelah sensor membuktikan perbaikan berhasil, lalu jadi pengetahuan terverifikasi.

### User Experience & Solution Design (10%)
- **Satu layar "Incident Room"**: timeline anomali → loss meter live → incident mirip → matriks G/NG → rekomendasi + tombol Approve → tiket.
- **Persona jelas:** operator control room (desktop), teknisi lapangan (mobile: foto/voice), reliability engineer (investigasi), plant manager (loss & keputusan).
- **Accessibility:** Bahasa Indonesia + English, input suara untuk teknisi bersarung tangan, kontras tinggi untuk control room, status warna + ikon (tidak hanya mengandalkan warna).
- **Kohesi:** setiap output agent menjadi input agent berikutnya di layar yang sama, sehingga pengguna tidak perlu pindah aplikasi.

---

## 7. Skenario Demo (±3 menit)

> Satu cerita yang melewati semua modul P0 dan menutup dengan loop.

| Waktu | Adegan | Modul / Stage | Kriteria yang disentuh |
|---|---|---|---|
| 0:00 | Data replay: vibrasi bearing pompa pelumas **P-104** naik perlahan. Alarm DCS statis masih hijau. | Sentinel (7) | Problem |
| 0:20 | Sentinel menandai anomali di hari ke-3. DQ gate memastikan **bukan sensor drift** (dicek silang dengan motor current). RUL: 9–14 hari. | Sentinel (2, 8) | Technical |
| 0:40 | Loss meter: **exposure US$535k** kalau gagal (18 jam × US$29,721) + kWh tambahan. | Ledger (5, N4) | Impact |
| 1:00 | Investigator: tag PT-104 otomatis terhubung ke P-104 + histori servis; menampilkan 2 incident mirip bulan lalu beserta CAPA. | Investigator (4, 9) | Technical, UX |
| 1:20 | Teknisi memotret oli dan merekam suara pompa dari HP. Gemini: "oli keruh + pola suara krepitasi". Matriks 4M+1E: **Machine NG, Material NG**, Method G. | Investigator (10, N1) | Technical, Innovation |
| 1:50 | Advisor: Impact × Control menghasilkan "ganti oli + realignment = Quick Win; modifikasi piping = Escalate". Jendela optimal: **Kamis 22:00 saat changeover**. Langkah SOP muncul dengan sitasi. | Advisor (12, 13, N2) | Innovation, Technical |
| 2:20 | Supervisor klik **Approve** → PIC otomatis (Mechanical Shift B) → tiket Problem Tank → notifikasi. | Closer (14, 15), Trust | UX |
| 2:40 | Fast-forward: setelah perbaikan, vibrasi kembali ke baseline, CAPA ditandai **Effective** dan masuk knowledge base. | Closer (N3) | Innovation |
| 2:55 | Slide penutup: angka impact + angka evaluasi agent. | Trust (N6) | Technical, Impact |

**Opsional (P1), momen wow kedua:** steam supply drop memunculkan 40 alarm; Sentinel mengelompokkannya jadi **1 root event + 3 aksi prioritas** (Stage 11).

---

## 8. Risiko Scope & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Terlalu banyak stage, demo jadi dangkal | Kunci P0 dulu sampai end-to-end jalan. P1 hanya dikerjakan kalau P0 sudah stabil. |
| Tidak punya data pabrik nyata | Simulator + dataset publik (bearing PHM/CWRU, C-MAPSS) + generator work order sintetis; skenario P-104 di-*replay* deterministik. |
| Gemini memberi rekomendasi tidak aman | Trust Layer: sitasi wajib, HITL approval untuk aksi safety, golden-set evaluation. |
| Juri menganggap "cuma dashboard + chatbot" | Tonjolkan agent yang **bertindak** (query data, buat tiket, verifikasi), angka evaluasi, dan multimodal. |
| Manufacturing Connect/MDE tidak bisa dipakai | Cukup sebut di arsitektur target ("production path"); demo memakai Pub/Sub + Dataflow + BigQuery. |
