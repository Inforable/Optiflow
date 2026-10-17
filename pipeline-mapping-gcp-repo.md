# Pipeline End-to-End: Reliability & Operational Intelligence — Mapping GCP + Referensi Repo

> Konteks: AI Builder Cup. Dokumen ini memetakan 15 stage masalah ke (1) pipeline end-to-end, (2) produk Google Cloud yang relevan, dan (3) repository open-source yang mirip atau bisa jadi referensi/komponen.
> Repo dicek per 17 Okt 2026 (bintang GitHub dan tanggal aktivitas terakhir ditulis biar kelihatan mana yang masih hidup).

---

## 1. Gambaran Pipeline End-to-End

15 stage itu sebenarnya satu alur tertutup (closed loop): dari sinyal mentah sampai tiket ditutup, lalu hasil penutupan tiket balik lagi jadi pengetahuan historis.

```
 ┌─────────────────────── LAYER A: DATA FOUNDATION ───────────────────────┐
 │ 1. Data Ingestion & Integrity  →  2. Data Quality & Governance           │
 │            ↓                                ↓                            │
 │ 4. Asset Taxonomy (tag ↔ Equipment ID ↔ incident)  ←→  3. KPI Mapping    │
 └──────────────────────────────────┬──────────────────────────────────────┘
                                    ↓
 ┌─────────────────────── LAYER B: VISIBILITY ────────────────────────────┐
 │ 5. Loss Quantification (US$/jam real-time) → 6. Single Pane of Glass     │
 └──────────────────────────────────┬──────────────────────────────────────┘
                                    ↓
 ┌─────────────────────── LAYER C: DETECTION ─────────────────────────────┐
 │ 7. Condition Monitoring (multivariate) → 8. Early Failure (P-F curve)    │
 │                                   ↓                                      │
 │                     11. Alert Prioritization (risk × US$ × safety)       │
 └──────────────────────────────────┬──────────────────────────────────────┘
                                    ↓
 ┌─────────────────────── LAYER D: DIAGNOSIS (AI Agent) ──────────────────┐
 │ 9. Historical Knowledge (RAG incident + CAPA) → 10. Root Cause (4M+1E    │
 │    G vs NG berbasis data sensor)                                         │
 └──────────────────────────────────┬──────────────────────────────────────┘
                                    ↓
 ┌─────────────────────── LAYER E: ACTION & CLOSED LOOP ──────────────────┐
 │ 12. Action Assessment (Impact × Control) → 13. Action Guidance (SOP)     │
 │ → 14. Action Ownership (RACI auto-assign) → 15. Action Tracking          │
 │    (Problem Tank: Repair → Maintain → Closed)                            │
 └──────────────────────────────────┬──────────────────────────────────────┘
                                    ↓
                tiket closed + CAPA → masuk ke knowledge base (Stage 9)
```

Nilai jual untuk juri: hari ini setiap stage berdiri sendiri. Solusinya menyambungkan semuanya, mulai dari sinyal vibrasi, ke "ini pompa P-104, terakhir diservis 3 minggu lalu", ke "kerugian US$495/menit", ke "bulan lalu kasus mirip beres dengan bersihkan seal flush line", ke "PIC: Mechanical Shift B, tiket #123".

> Hitungan cepat: US$67.2M ÷ 2,261 jam = **US$29,721/jam ≈ US$495/menit**. Angka ini cocok untuk header dashboard Stage 5.

---

## 2. Arsitektur Referensi di Google Cloud

```
 [PI Historian / DCS / PLC]      [SAP PM]              [Logsheet manual, PDF investigasi, SOP]
        │ OPC UA / PI Web API       │ SLT / Cortex          │
        ▼                           ▼                       ▼
 Manufacturing Connect (Litmus)   BigQuery Connector    Document AI (OCR/Form Parser)
   atau Cloud Run connector       for SAP / Cortex      + AppSheet (logsheet digital)
        │                           │                       │
        ▼                           │                       ▼
   Pub/Sub ──► Dataflow (validasi DQ, enrich asset context, hitung loss rate)
        │                           │                       │
        ▼                           ▼                       ▼
 ┌──────────────────────── BigQuery (single source of truth) ───────────────────────┐
 │ timeseries | asset master (ISO 14224) | work order | incident | KPI | tiket      │
 │ + BigQuery ML / AI.FORECAST / AI.DETECT_ANOMALIES (TimesFM) + Vector Search       │
 └───────────────────────────────────────────────────────────────────────────────────┘
        │ Dataplex Universal Catalog (DQ scan, glossary, lineage)  │ Spanner Graph (asset graph)
        ▼                                                          ▼
 Vertex AI (model P-F/RUL, autoencoder)        Vertex AI Search / RAG Engine (incident + SOP)
        │                                                          │
        └────────────► ADK multi-agent di Vertex AI Agent Engine ◄─┘
                         (Detect → Diagnose → Recommend → Assign)
                         tools: MCP Toolbox for Databases → BigQuery
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
 Looker (KPI semantic layer,   Google Chat / Gemini Enterprise   Workflows + Eventarc
 dashboard hierarki)           (notifikasi + chat operator)      → AppSheet / Firestore
                                                                 (Problem Tank) / SAP PM
```

---

## 3. Tabel Ringkas Mapping

| # | Stage | Produk GCP utama | Peran AI/Gemini | Repo referensi utama |
|---|---|---|---|---|
| 1 | Data Ingestion & Integrity | Manufacturing Connect, Manufacturing Data Engine, Pub/Sub, Dataflow, BigQuery, Cortex Framework (SAP) | — (fondasi) | united-manufacturing-hub, cortex-data-foundation, apache/plc4x |
| 2 | Data Quality & Governance | Dataplex DQ scan, Dataflow, Cloud Monitoring | Gemini generate aturan DQ dari metadata | cloud-data-quality (CloudDQ), great_expectations, SaQC, adtk |
| 3 | KPI & Relational Mapping | Looker (LookML semantic layer), Dataform, BigQuery | Conversational Analytics (tanya KPI pakai bahasa natural) | metricflow, cube, UMH (OEE) |
| 4 | Asset Taxonomy | Dataplex Universal Catalog, Spanner Graph, BigQuery | Gemini untuk entity resolution (PT-104 ↔ P-104) | basyx-python-sdk, FAAAST-Service, Brick, maintie |
| 5 | Loss Quantification | Dataflow streaming / BigQuery continuous query, Looker | Gemini narasi "kenapa loss naik" | UMH, CueObserve |
| 6 | Operational Visibility | Looker, Looker Studio, Gemini in Looker | Ringkasan otomatis per level (exec vs teknisi) | grafana, UMH, OPCFoundation/UA-CloudDashboard |
| 7 | Condition Monitoring | BigQuery ML (ARIMA_PLUS, AI.DETECT_ANOMALIES/TimesFM), Vertex AI | Anomali multivariat | pyod, adtk, telemanom, darts, timesfm |
| 8 | Failure Early Detection (P-F) | Vertex AI Training/Pipelines, Model Monitoring, BigQuery ML | Prediksi RUL / jarak ke titik F | rul_codes_open, Predictive-Maintenance-using-LSTM, PyTorch-Transformer-for-RUL |
| 9 | Historical Knowledge | Vertex AI Search, RAG Engine, Document AI, BigQuery Vector Search | Semantic search incident mirip | generative-ai, maintie, industrial-general-rag |
| 10 | Root Cause Verification | ADK agent + Gemini, BigQuery ML contribution analysis | 4M+1E G vs NG dari data sensor | PyRCA, dowhy, root-cause-analysis (KG) |
| 11 | Alert Prioritization | Pub/Sub, Cloud Run, BigQuery, Firestore | Grouping alarm flood + skor risiko | keephq/keep, AlarmsByTheNumbers, online_causal_criticality_analysis |
| 12 | Action Assessment | Gemini (structured output), ADK | Skoring Impact × Control | (belum ada repo domain, bangun sendiri) |
| 13 | Action Guidance | Vertex AI Search (SOP), ADK, Google Chat app | Langkah mitigasi + sitasi SOP | adk-recipes, agent-starter-pack, industrial-ai-agents |
| 14 | Action Ownership | Workflows, Eventarc, Application Integration (SAP), Google Chat API | Assign PIC dari matriks RACI | keephq/keep (workflow), Grashjs/cmms |
| 15 | Action Tracking | AppSheet, Firestore/Cloud SQL, Cloud Scheduler, Looker | Ringkasan status + eskalasi SLA | Grashjs/cmms, odoo (maintenance), erpnext |

---

## 4. Detail per Stage

### Stage 1 — Data Ingestion & Integrity
**Masalah inti:** sinyal PI Historian, SAP PM, dan logsheet manual terpisah.

**Produk GCP**
- **Manufacturing Connect / MC edge (Litmus)**: edge connector ke 250+ protokol mesin (OPC UA, Modbus, dll), streaming ke cloud.
- **Manufacturing Data Engine (MDE)**: template ingest + contextualize + simpan data pabrik; dibangun di atas Pub/Sub, Dataflow, BigQuery, dan Vertex AI.
- **Pub/Sub + Dataflow**: jalur streaming kalau tidak pakai MDE (lebih realistis untuk hackathon).
- **BigQuery Connector for SAP / Cortex Framework**: tarik data SAP PM (notification, order, equipment master) ke BigQuery.
- **Document AI + AppSheet**: digitalisasi logsheet manual (OCR scan lama, form AppSheet untuk logsheet baru).

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [united-manufacturing-hub/united-manufacturing-hub](https://github.com/united-manufacturing-hub/united-manufacturing-hub) | 402 | Unified Namespace untuk pabrik (OT+IT dalam satu arsitektur). Referensi desain paling dekat. |
| [GoogleCloudPlatform/cortex-data-foundation](https://github.com/GoogleCloudPlatform/cortex-data-foundation) | 240 | Data model SAP → BigQuery resmi Google (untuk sisi SAP PM). |
| [apache/plc4x](https://github.com/apache/plc4x) | 1.7k | Adapter protokol industri (PLC, Modbus, S7). |
| [FreeOpcUa/opcua-asyncio](https://github.com/FreeOpcUa/opcua-asyncio) | 1.5k | Client/server OPC UA Python, bisa dipakai untuk simulator. |
| [barnstee/UA-CloudPublisher](https://github.com/barnstee/UA-CloudPublisher) | 47 | OPC UA PubSub → cloud publisher. |
| [AVEVA/sample-pi_web_api-common_actions-python](https://github.com/AVEVA/sample-pi_web_api-common_actions-python) | 60 | Sampel resmi AVEVA/OSIsoft untuk ambil data PI Web API pakai Python. |
| [jvachier/industrial-maintenance-synthetic-data](https://github.com/jvachier/industrial-maintenance-synthetic-data) | 1 | Generator data sintetis sensor tag + work order (1M+ record). Berguna kalau tidak punya data nyata. |

---

### Stage 2 — Data Quality & Governance
**Masalah inti:** flatline tag dan sensor drift tidak terdeteksi (contoh: pressure transmitter reaktor drift).

**Produk GCP**
- **Dataplex Universal Catalog: Data Quality scan / Auto DQ**: aturan range, null, freshness, uniqueness di tabel BigQuery.
- **Dataflow (streaming)**: validasi inline sebelum data masuk tabel monitoring (range span instrumen, unit, timestamp out-of-order, flatline window).
- **Cloud Monitoring + Alerting**: alert kalau DQ score drop.
- **Gemini**: generate aturan DQ otomatis dari metadata instrumen (span, unit, tipe sensor).

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [GoogleCloudPlatform/cloud-data-quality](https://github.com/GoogleCloudPlatform/cloud-data-quality) | 283 | CloudDQ, engine DQ berbasis YAML untuk BigQuery (dasar dari Dataplex DQ task). |
| [great-expectations/great_expectations](https://github.com/great-expectations/great_expectations) | 11.8k | Framework validasi data paling populer. Catatan: repo sekarang redirect ke `fivetran/great_expectations`. |
| [SaQC (UFZ, GitLab)](https://git.ufz.de/rdm-software/saqc) | — | Quality control time-series sensor dengan flag per observasi (range, MAD, constant). Paling pas untuk kasus flatline/drift. Lisensi GPL-3. |
| [arundo/adtk](https://github.com/arundo/adtk) | 1.2k | Detector rule-based: `PersistAD`, `LevelShiftAD`, `InterQuartileRangeAD`. Cocok untuk flatline dan drift. Terakhir aktif 2024. |
| [NorthernLightx/tsdive](https://github.com/NorthernLightx/tsdive) | 0 | Kecil tapi spesifik: DQ untuk process time series (gap, bad quality code, flatline, timestamp). |

---

### Stage 3 — KPI & Relational Mapping
**Masalah inti:** Production bilang efisiensi 95%, Maintenance bilang performa turun 15%.

**Produk GCP**
- **Looker (LookML semantic layer)**: satu definisi metrik (OEE, availability, MTBF, MTTR, energy intensity) dipakai semua fungsi.
- **Dataform**: transformasi SQL terversi di BigQuery (KPI as code).
- **Looker Conversational Analytics / Gemini in Looker**: tanya KPI pakai bahasa natural, dan jawabannya tetap mengikuti definisi yang sama.

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [dbt-labs/metricflow](https://github.com/dbt-labs/metricflow) | 1.8k | Metric definition as code, konsep yang sama dengan LookML. |
| [cube-js/cube](https://github.com/cube-js/cube) | 21k | Semantic layer open-source, alternatif kalau tidak pakai Looker. |
| [united-manufacturing-hub/united-manufacturing-hub](https://github.com/united-manufacturing-hub/united-manufacturing-hub) | 402 | Punya kalkulasi OEE dan Shopfloor KPI bawaan, bisa jadi referensi formula standar. |
| [GoogleCloudPlatform/bigquery-utils](https://github.com/GoogleCloudPlatform/bigquery-utils) | 1.3k | UDF/utility BigQuery untuk transformasi. |

---

### Stage 4 — Asset Taxonomy
**Masalah inti:** PT-104 (tag PI), P-104 (pompa fisik), dan kode di incident DB tidak tersambung.

**Produk GCP**
- **Dataplex Universal Catalog**: business glossary + aspect untuk hierarki ISO 14224 (Plant → Unit → Equipment → Component).
- **Spanner Graph** (atau tabel relasi di BigQuery): asset graph tag ↔ equipment ↔ work order ↔ incident.
- **Gemini (entity resolution)**: mencocokkan otomatis penamaan yang beda format (PT-104, P104, "Pompa 104 Unit A"), lalu manusia approve.
- **MDE metadata**: kontekstualisasi tag dengan metadata aset.

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [eclipse-basyx/basyx-python-sdk](https://github.com/eclipse-basyx/basyx-python-sdk) | 105 | Asset Administration Shell (standar digital twin Industri 4.0). |
| [FraunhoferIOSB/FAAAST-Service](https://github.com/FraunhoferIOSB/FAAAST-Service) | 94 | Server AAS siap pakai. |
| [BrickSchema/Brick](https://github.com/BrickSchema/Brick) | 408 | Skema metadata untuk sensor ↔ equipment (domain gedung, tapi pola tag-to-asset-nya bisa ditiru). |
| [nlp-tlp/maintie](https://github.com/nlp-tlp/maintie) | 24 | Dataset + skema ekstraksi entitas dari teks maintenance (equipment, failure mode). Bisa membantu memetakan teks incident ke equipment. |
| [aws-solutions-library-samples/guidance-for-digital-thread-using-graph-and-generative-ai-on-aws](https://github.com/aws-solutions-library-samples/guidance-for-digital-thread-using-graph-and-generative-ai-on-aws) | 26 | Pola "digital thread" pakai graph + GenAI. Versi AWS, tapi arsitekturnya bisa ditranslasi ke Spanner Graph + Gemini. |

> Catatan: ISO 14224 adalah standar berbayar dan tidak ada repo open-source resmi untuk taksonominya. Untuk hackathon, cukup bikin tabel hierarki 9 level + failure code (mode/cause/mechanism) sendiri, lalu sebut "ISO 14224-aligned".

---

### Stage 5 — Loss Quantification
**Masalah inti:** kerugian baru dihitung bulanan, operator tidak tahu kalau penurunan rate bernilai ~US$500/menit.

**Produk GCP**
- **Dataflow streaming / BigQuery continuous queries**: hitung `(rate_target - rate_aktual) × margin/unit` dan `downtime × US$29,721/jam` secara real-time.
- **Looker**: tile "Cost of Unreliability — live" per line/aset.
- **Pub/Sub → Cloud Run**: trigger eskalasi kalau loss rate melewati ambang US$.
- **Gemini**: narasi singkat "loss naik karena line 2 turun 18% sejak 14:20, kemungkinan terkait vibrasi K-201".

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [united-manufacturing-hub/united-manufacturing-hub](https://github.com/united-manufacturing-hub/united-manufacturing-hub) | 402 | Downtime/OEE tracking real-time; tinggal ditambah layer US$. |
| [cuebook/CueObserve](https://github.com/cuebook/CueObserve) | 234 | Anomali + RCA di atas data warehouse (bisa dipakai di metrik loss). Sudah tidak aktif sejak 2022. |

> Gap: hampir tidak ada repo open-source yang khusus "real-time cost of unreliability". Ini peluang diferensiasi yang bagus untuk lomba.

---

### Stage 6 — Operational Visibility (Single Pane of Glass)
**Masalah inti:** plant manager harus buka 4 laporan.

**Produk GCP**
- **Looker**: dashboard hierarkis (Executive → Plant → Line → Equipment) dengan drill-down, embed ke portal.
- **Looker Studio**: alternatif gratis untuk demo.
- **Gemini in Looker / Conversational Analytics API**: "kenapa target produksi hari ini meleset?"
- **Gemini Enterprise**: satu pintu chat untuk eksekutif yang sekaligus mengakses dashboard, dokumen, dan agent.

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [grafana/grafana](https://github.com/grafana/grafana) | 77k | Standar de-facto dashboard time-series. Bisa jalan di GKE/Cloud Run dan baca BigQuery. |
| [united-manufacturing-hub/united-manufacturing-hub](https://github.com/united-manufacturing-hub/united-manufacturing-hub) | 402 | Template dashboard OEE + energy. |
| [OPCFoundation/UA-CloudDashboard](https://github.com/OPCFoundation/UA-CloudDashboard) | 22 | Dashboard referensi OPC UA via MQTT. |
| [thingsboard/thingsboard](https://github.com/thingsboard/thingsboard) | 22k | Platform IoT all-in-one (device, rule engine, dashboard). Bisa jadi referensi UX. |

---

### Stage 7 — Condition Monitoring
**Masalah inti:** hanya alarm statis high/low; tekanan oli bearing turbin turun pelan 5 hari tanpa notifikasi.

**Produk GCP**
- **BigQuery ML**:
  - `AI.FORECAST` / `AI.DETECT_ANOMALIES` dengan **TimesFM** (zero-shot, tanpa training). Cek status GA/Preview di dokumentasi terbaru.
  - `ARIMA_PLUS` + `ML.DETECT_ANOMALIES` untuk trend/seasonality.
  - Autoencoder / K-means di BigQuery ML untuk anomali multivariat.
- **Vertex AI**: model custom (LSTM autoencoder, isolation forest) + endpoint untuk streaming inference dari Dataflow.
- **Timeseries Insights API**: anomali skala besar real-time (masih terdokumentasi; cek status sebelum dipakai).

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [google-research/timesfm](https://github.com/google-research/timesfm) | 34k | Foundation model time-series dari Google, juga tersedia native di BigQuery. Narasi "full Google stack" jadi kuat. |
| [yzhao062/pyod](https://github.com/yzhao062/pyod) | 10k | Library anomaly detection terlengkap (IForest, ECOD, AutoEncoder). |
| [arundo/adtk](https://github.com/arundo/adtk) | 1.2k | Deteksi level shift / trend drift, cocok untuk kasus "turun pelan 5 hari". |
| [khundman/telemanom](https://github.com/khundman/telemanom) | 1.2k | LSTM anomaly multivariat (dari NASA), dengan dynamic threshold. |
| [unit8co/darts](https://github.com/unit8co/darts) | 9.5k | Forecasting + anomaly detection dalam satu API. |
| [salesforce/Merlion](https://github.com/salesforce/Merlion) | 4.5k | Framework time-series intelligence. Sudah di-archive, jadi pakai sebagai referensi saja. |

---

### Stage 8 — Failure Early Detection (P-F Curve)
**Masalah inti:** degradasi bearing/seal baru ketahuan dekat titik F.

**Produk GCP**
- **Vertex AI Training + Pipelines**: model RUL (Remaining Useful Life) / health index per aset.
- **Vertex AI Model Monitoring**: deteksi drift model.
- **BigQuery ML**: regresi health index sederhana untuk MVP.
- **Gemini**: menerjemahkan output model ke bahasa operator ("bearing P-07 diperkirakan masuk zona kritis dalam 9–14 hari").

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [biswajitsahoo1111/rul_codes_open](https://github.com/biswajitsahoo1111/rul_codes_open) | 221 | Kumpulan algoritma RUL standar (CNN, LSTM, dsb) di dataset publik. |
| [umbertogriffo/Predictive-Maintenance-using-LSTM](https://github.com/umbertogriffo/Predictive-Maintenance-using-LSTM) | 739 | Contoh klasik prediksi failure window pakai LSTM. |
| [jiaxiang-cheng/PyTorch-Transformer-for-RUL-Prediction](https://github.com/jiaxiang-cheng/PyTorch-Transformer-for-RUL-Prediction) | 311 | Transformer untuk RUL (dataset turbofan C-MAPSS). |
| [ddrrrr/projectRUL](https://github.com/ddrrrr/projectRUL) | 326 | RUL bearing (dataset PHM 2012). Pas untuk kasus bearing pompa pelumas. |
| [awslabs/predictive-maintenance-using-machine-learning](https://github.com/awslabs/predictive-maintenance-using-machine-learning) | 110 | Arsitektur PdM end-to-end (versi AWS, bisa ditranslasi ke GCP). |
| [GoogleCloudPlatform/mfg-ml-examples](https://github.com/GoogleCloudPlatform/mfg-ml-examples) | 18 | Contoh ML manufaktur dari Google. Sudah di-archive, tapi relevan. |
| [makinarocks/awesome-industrial-machine-datasets](https://github.com/makinarocks/awesome-industrial-machine-datasets) | 565 | Daftar dataset industri (bearing, pompa, kompresor) untuk training/demo. |

---

### Stage 9 — Historical Knowledge
**Masalah inti:** 380 incident, investigasi 4M+1E, dan CAPA cuma jadi arsip.

**Produk GCP**
- **Document AI**: ekstrak isi PDF/scan laporan investigasi dan CAPA (Layout Parser / Form Parser).
- **Vertex AI Search** (atau **Vertex AI RAG Engine**): index incident + CAPA + SOP, semantic search.
- **Gemini embeddings + BigQuery Vector Search**: "cari incident mirip" langsung dari anomali aktif (embedding dari deskripsi anomali + metadata aset).
- **Gemini**: ringkas "3 incident mirip, 2 di antaranya selesai dengan bersihkan seal flush line, MTTR 2 jam".

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [GoogleCloudPlatform/generative-ai](https://github.com/GoogleCloudPlatform/generative-ai) | 17.8k | Sampel resmi RAG, Vertex AI Search, embeddings, dan Gemini. Titik awal paling cepat. |
| [nlp-tlp/maintie](https://github.com/nlp-tlp/maintie) | 24 | Information extraction dari teks maintenance (failure mode, komponen). |
| [phoenix-zhou/industrial-general-rag](https://github.com/phoenix-zhou/industrial-general-rag) | 549 | RAG industri dengan intent recognition + FAQ. |
| [riedlerm/multimodal_rag_for_industry](https://github.com/riedlerm/multimodal_rag_for_industry) | 73 | RAG multimodal (teks + gambar) untuk dokumen industri, berguna untuk P&ID atau foto kerusakan. |
| [syrinehentati/IncidentIQ](https://github.com/syrinehentati/IncidentIQ) | 0 | Kecil, tapi persis polanya: RAG incident dengan Gemini embeddings + similarity search. |

---

### Stage 10 — Root Cause Verification (4M+1E, G vs NG)
**Masalah inti:** RCA subjektif; operator menyalahkan filter (Material) padahal data arus motor menunjukkan beban mekanis (Machine).

**Produk GCP**
- **ADK agent + Gemini**: agent "RCA Verifier" yang untuk setiap kategori 4M+1E (Man, Machine, Method, Material, Environment) mengambil sinyal terkait dari BigQuery, membandingkannya dengan kriteria G/NG, lalu menghasilkan matriks bukti.
- **MCP Toolbox for Databases**: tool aman agar agent bisa query BigQuery/AlloyDB.
- **BigQuery ML contribution analysis**: cari dimensi/sinyal yang paling berkontribusi terhadap perubahan metrik.

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [salesforce/PyRCA](https://github.com/salesforce/PyRCA) | 572 | Library RCA berbasis metrik (causal graph, Bayesian). |
| [py-why/dowhy](https://github.com/py-why/dowhy) | 8.3k | Causal inference, termasuk modul root cause attribution. |
| [jorge-martinez-gil/root-cause-analysis](https://github.com/jorge-martinez-gil/root-cause-analysis) | 18 | RCA industri berbasis knowledge graph (studi kasus pembangkit). |
| [rainstorm12/Root-KGD](https://github.com/rainstorm12/Root-KGD) | 37 | Diagnosis fault industri gabungan data proses + knowledge graph. |
| [MarkNwilliam/root-cause-analysis-tool](https://github.com/MarkNwilliam/root-cause-analysis-tool) | 0 | Klasifikasi Fishbone 6M + 5 Whys + generator laporan CAPA. Paling mirip konsep 4M+1E. |
| [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox) | 16.6k | MCP server database resmi Google (dulu bernama genai-toolbox). |

---

### Stage 11 — Alert Prioritization
**Masalah inti:** 40 alarm muncul bersamaan saat steam drop, operator panik.

**Produk GCP**
- **Pub/Sub → Cloud Run (scoring service)**: skor = f(process safety class, potensi downtime, US$/jam dari Stage 5, kekritisan aset dari Stage 4).
- **Gemini**: grouping alarm flood ke satu "parent event" ("steam header pressure drop → 37 alarm turunan"), lalu tampilkan 1–3 aksi utama.
- **BigQuery**: metrik alarm ISA-18.2 / EEMUA 191 (alarm/jam, chattering, standing alarm).
- **Firestore**: state alarm real-time untuk UI.

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [keephq/keep](https://github.com/keephq/keep) | 12.4k | Platform alert management open-source: dedup, correlation, AI enrichment, workflow. Konsepnya paling dekat (domain IT, tapi polanya identik). |
| [cbvance/AlarmsByTheNumbers](https://github.com/cbvance/AlarmsByTheNumbers) | 0 | Metrik ISA-18.2/EEMUA 191 + deteksi flood/chattering dari alarm journal Ignition. Sangat baru. |
| [GianMan89/online_causal_criticality_analysis](https://github.com/GianMan89/online_causal_criticality_analysis) | 0 | Riset: analisis kausal alarm flood di process plant. |
| [karine-ung/PER4Mance](https://github.com/karine-ung/PER4Mance) | 4 | Prototipe HMI untuk manajemen alarm flood. |

---

### Stage 12 — Action Assessment (Impact × Control Matrix)
**Masalah inti:** 3 hari habis membahas modifikasi piping yang butuh approval kantor pusat, padahal realignment pompa bisa langsung dikerjakan.

**Produk GCP**
- **Gemini (structured output / JSON schema)**: untuk tiap kandidat aksi dari NG criteria, beri skor `impact` (US$ terhindar, risk reduction) dan `control` (dalam kewenangan shift / plant / HO, butuh CAPEX atau tidak).
- **ADK**: agent "Action Screener" yang menempatkan aksi ke 4 kuadran (Quick Win, Major Project, Escalate, Deprioritize).
- **BigQuery**: tabel referensi kewenangan (delegation of authority) dan biaya historis aksi.

**Repo**
- Tidak ada repo domain-spesifik yang matang. Logikanya sederhana (rubric + LLM), jadi lebih baik dibangun sendiri di atas [google/adk-python](https://github.com/google/adk-python) (21.9k ⭐).
- Referensi UI matriks: [EmbeddedArchitectLLC/eisenhower-matrix](https://github.com/EmbeddedArchitectLLC/eisenhower-matrix) (effort/impact, sangat kecil).

> Ini justru bagian yang paling "baru". Hampir tidak ada yang menggabungkan NG criteria dengan matriks Impact × Control secara otomatis.

---

### Stage 13 — Action Guidance
**Masalah inti:** operator shift malam bingung harus kurangi feed rate atau langsung backwash.

**Produk GCP**
- **Vertex AI Search (SOP corpus)** + **Gemini**: jawaban langkah demi langkah dengan sitasi nomor SOP dan halaman (grounded).
- **ADK agent "Guidance"**: menggabungkan konteks anomali (Stage 7), incident mirip (Stage 9), dan SOP.
- **Google Chat app / Gemini Enterprise**: kanal ke operator; **Gemini Live API** kalau ingin demo voice/kamera untuk teknisi lapangan.

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [google/adk-recipes](https://github.com/google/adk-recipes) | 10.4k | Contoh agent ADK (dulu `adk-samples`), termasuk pola RAG dan multi-agent. |
| [GoogleCloudPlatform/agent-starter-pack](https://github.com/GoogleCloudPlatform/agent-starter-pack) | 6.5k | Template agent production-ready ke Agent Engine/Cloud Run, plus CI/CD dan eval. Cocok untuk scaffolding cepat. |
| [GoogleCloudPlatform/vertex-ai-samples](https://github.com/GoogleCloudPlatform/vertex-ai-samples) | 790 | Notebook resmi Vertex AI. |
| [choukha/industrial-ai-agents](https://github.com/choukha/industrial-ai-agents) | 22 | Agent LLM untuk use case industri. |
| [beprith/OT-Service-Support-Assistant](https://github.com/beprith/OT-Service-Support-Assistant) | 3 | Chatbot support OT, mirip konsep "SOP assistant". |

---

### Stage 14 — Action Ownership (RACI auto-assign)
**Masalah inti:** kavitasi pompa tercatat di shift report, tidak ada PIC, dibiarkan berhari-hari.

**Produk GCP**
- **Eventarc + Workflows**: event "issue confirmed" → lookup RACI (BigQuery/Firestore: aset × tipe failure × shift → R/A/C/I) → buat tiket → notifikasi.
- **Application Integration (SAP connector)**: otomatis buat **SAP PM Notification / Work Order** dengan PIC terisi.
- **Google Chat API / Gmail API**: kirim ke R (responsible) dengan tombol Acknowledge; kalau tidak di-ack dalam X menit, eskalasi ke A (accountable).

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [keephq/keep](https://github.com/keephq/keep) | 12.4k | Workflow engine alert → assign → notify. |
| [Grashjs/cmms](https://github.com/Grashjs/cmms) | 836 | Atlas CMMS: work order, assignment, aset, mobile app. Self-hosted. |
| [odoo/odoo](https://github.com/odoo/odoo) | 55k | Modul Maintenance (equipment, team, request). |
| [frappe/erpnext](https://github.com/frappe/erpnext) | 40k | Modul Asset Maintenance + assignment rule. |

---

### Stage 15 — Action Tracking (Problem Tank)
**Masalah inti:** perbaikan clamp pipa disepakati di rapat, tapi tracking tersebar di chat sampai bocornya makin parah.

**Produk GCP**
- **AppSheet**: app Problem Tank no-code dalam hitungan jam (status Repair → Maintain → Closed, foto before/after, tanda tangan).
- **Firestore / Cloud SQL**: backend tiket; **Cloud Scheduler + Cloud Run**: cek SLA dan eskalasi otomatis.
- **Looker**: aging tiket, tiket overdue per tim, recurring issue.
- **Gemini**: ringkasan mingguan otomatis ("5 tiket overdue, 2 berisiko jadi incident ulang"). Saat tiket closed, CAPA otomatis diindeks kembali ke Stage 9, sehingga loop-nya tertutup.

**Repo**
| Repo | ⭐ | Relevansi |
|---|---|---|
| [Grashjs/cmms](https://github.com/Grashjs/cmms) | 836 | Work order lifecycle + dashboard. |
| [odoo/odoo](https://github.com/odoo/odoo) | 55k | Maintenance request kanban (New → In Progress → Repaired → Scrap). |
| [divya03116/prahari](https://github.com/divya03116/prahari) | 1 | Industrial safety reporting + corrective-action tracking. Kecil, tapi konsepnya mirip. |

---

## 5. Saran Scope untuk AI Builder Cup

15 stage tidak mungkin dibangun penuh. Pilih satu **"golden thread"** yang menembus semua layer dengan satu skenario demo:

> **Skenario demo:** "Vibrasi bearing pompa pelumas P-104 naik pelan selama 2 minggu."

| Langkah demo | Stage | Implementasi minimal (MVP) |
|---|---|---|
| Data sensor sintetis + SAP PM dummy masuk BigQuery | 1, 2 | Python simulator → Pub/Sub → BigQuery; satu aturan DQ flatline/range |
| Tag PT-104 otomatis terhubung ke P-104 + histori servis | 4 | Tabel asset master + Gemini entity matching |
| Anomali terdeteksi sebelum alarm statis | 7, 8 | `AI.DETECT_ANOMALIES` (TimesFM) di BigQuery + health index sederhana |
| Loss rate US$/menit muncul | 5, 6 | Looker Studio dengan tile live loss |
| Agent menampilkan incident mirip + verifikasi 4M+1E | 9, 10 | ADK agent + Vertex AI Search + MCP Toolbox ke BigQuery |
| Aksi diprioritaskan + SOP + PIC otomatis | 12, 13, 14 | Gemini structured output + RACI table + Google Chat webhook |
| Tiket masuk Problem Tank | 15 | AppSheet di atas BigQuery/Sheets |

**Arsitektur agent (ADK multi-agent) yang disarankan:**
1. `sentinel_agent`: membaca hasil anomali dan skor prioritas (Stage 7, 8, 11)
2. `historian_agent`: RAG incident + CAPA (Stage 9)
3. `rca_agent`: matriks G/NG 4M+1E dari data sensor (Stage 10)
4. `action_agent`: Impact × Control, SOP guidance, assign RACI, buat tiket (Stage 12–15)
5. `orchestrator`: root agent yang dipanggil dari Google Chat / UI

**Repo yang paling layak di-fork/dijadikan fondasi:**
1. [GoogleCloudPlatform/agent-starter-pack](https://github.com/GoogleCloudPlatform/agent-starter-pack): scaffolding agent + deploy
2. [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox): agent ↔ BigQuery
3. [GoogleCloudPlatform/generative-ai](https://github.com/GoogleCloudPlatform/generative-ai): RAG / Vertex AI Search
4. [google-research/timesfm](https://github.com/google-research/timesfm) atau BigQuery `AI.DETECT_ANOMALIES`: deteksi anomali
5. [keephq/keep](https://github.com/keephq/keep): inspirasi alert correlation + workflow

**Dataset untuk demo:** [makinarocks/awesome-industrial-machine-datasets](https://github.com/makinarocks/awesome-industrial-machine-datasets) (bearing/pompa), NASA C-MAPSS (RUL), atau generator [jvachier/industrial-maintenance-synthetic-data](https://github.com/jvachier/industrial-maintenance-synthetic-data) untuk sensor + work order sekaligus.

---

## 6. Catatan & Caveat

- **Manufacturing Connect / MDE** butuh lisensi dan deployment edge (Litmus). Untuk hackathon, cukup **sebut di arsitektur target** dan pakai simulator → Pub/Sub → BigQuery di demo.
- **`AI.DETECT_ANOMALIES`** di beberapa dokumentasi masih berlabel *Preview*, sedangkan model TimesFM di BigQuery sudah diumumkan GA. Cek status terbaru sebelum klaim di pitch.
- **ISO 14224** berbayar dan tidak ada implementasi open-source resmi, jadi taksonominya dibangun sendiri.
- Beberapa repo yang paling relevan secara domain (AlarmsByTheNumbers, tsdive, IncidentIQ, root-cause-analysis-tool) **masih sangat kecil (0–2 ⭐)**. Pakai sebagai inspirasi pola, bukan dependency.
- Repo yang sudah **archived**: `salesforce/Merlion`, `GoogleCloudPlatform/mfg-ml-examples`, `Azure/AI-PredictiveMaintenance`. Masih aman sebagai referensi, tapi jangan jadi fondasi.
- Stage yang **paling sedikit solusi open-source-nya** (5 Loss Quantification, 10 RCA 4M+1E, 12 Impact × Control) bisa diangkat sebagai **diferensiasi utama** di pitch.
