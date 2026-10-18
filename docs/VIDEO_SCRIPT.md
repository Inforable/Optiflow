# Demo Video: Script and Demo Flow (Optiflow LubeGuard)

Target length **3:00 to 3:02**. The FAQ says "under 3 minutes" and the T&C says "strictly three to four minutes" (the T&C prevails over other materials); 3:00 to 3:02 satisfies the T&C and the themes page. Confirm on Discord before export.

**The one sentence judges should repeat:** "It refused to guess, asked the engineer for one photo of the oil, even with no signal, and found the leak behind the clogged filter."

**Rules for the video**
- One story, one case (C-0412), one causal chain. Never say stage codes, module names or "4M+1E" without explaining it.
- English narration plus **burned-in English subtitles**. The Bahasa voice note is subtitled in English.
- Show the live URL once (end card). Mention "synthetic demo plant" once on screen.
- **Only real numbers.** The eval line uses numbers from a run against the live, deployed backend. If you do not have them, cut that line. Never show the "cached result" badge while saying the AI did it live; if it appears, re-take.
- Narration is about 420 words at a calm 150 words per minute (about 2:50), which leaves room for pauses at the hero moment.

---

## 1. Cast, props and devices

| Item | Detail |
|---|---|
| Narrator | One teammate, calm and plain. Record the voice-over separately in a quiet room (phone voice memo is fine). |
| Manager seat | Laptop, Chrome, deployed URL, signed in by "Enter as Manager". Persona on screen: Dimas, Maintenance Supervisor. |
| Engineer seat | Android phone (Chrome; offline persistence is supported on Chrome, Safari, Firefox). Persona: Joko, Field Engineer. Teammate's gloved hands only. |
| Props | Two clear bottles: (1) **hazy**: turbine or engine oil shaken hard with a little water (milky, cloudy); (2) **clear** oil as a control (off camera test). Work gloves. A light source behind the bottle (window or phone torch). |
| Location for the offline shot | Any plain wall or utility area that looks industrial; no logos, no faces needed. |

---

## 2. Pre-recording checklist (do 30 minutes before)

1. Deployed app on Cloud Run with `AI_MODE=live`; `/api/health` shows `"aiMode":"live"`.
2. Do one full dry run (section 4). Confirm **no "cached result" badge** appears on investigate and evidence. If it does, check the Gemini key and quota first.
3. Replace `frontend/public/samples/` illustrations with real photos if you will use "Use sample photo" anywhere; for the video, take a **real photo** with "Take photo".
4. Laptop: Chrome window 1920x1080, browser zoom 110%, bookmarks bar hidden, all other tabs closed, OS notifications off, cursor highlight on (OBS or the OS accessibility setting).
5. Phone: do-not-disturb on, brightness up, battery saver off, screen recorder ready (Android built-in recorder, or `scrcpy --record phone.mp4` over USB, which also mirrors the phone on the laptop for split screen).
6. In the Manager role menu, press **Reset demo**, then **Enter as Manager** fresh, so the case starts clean.
7. On the phone, open the join link by scanning the QR code in the Manager header **before** recording (so the Engineer app is installed and cached). Then Reset demo on the laptop again and re-join on the phone (join codes change on reset); keep the Engineer app open on **My tasks**.
8. Recorder: OBS, 1920x1080, 30 fps, MP4, system audio off (voice is recorded separately).

---

## 3. Script (scene by scene)

Format: what is on screen, the exact narration, and the on-screen caption (burned in, in addition to subtitles).

| Time | On screen | Narration (voice-over) | Caption / overlay |
|---|---|---|---|
| **0:00 to 0:08** Cold open | Close-up, phone camera: gloved hand holds the **milky oil bottle** against light. Hard cut to the laptop: the **Material** cell flips from amber **UNVERIFIED** to red **NG**. | "This bottle just found a leak that nobody was looking for." | |
| **0:08 to 0:28** The problem | Landing page hero, slow scroll; then the Incident Room chart: header pressure line sliding down while the dashed alarm line stays above it. | "In a steam turbine, the bearings ride on a thin film of lube oil. At this plant, the oil header pressure slid for five days. The alarm stayed green, because the pressure never crossed the line. And downtime here costs about thirty thousand dollars an hour." | "US$67.2M / 2,261 downtime hours = US$29,721 per hour (AI Builder Cup problem brief)" and small "Synthetic demo plant" |
| **0:28 to 0:40** Meet LubeGuard | Click **Enter as Manager**. Incident Room loads; the **lube-oil skid diagram** fills the frame with live tag chips. | "Optiflow LubeGuard is built for one system: the turbine lube-oil console. It knows its pumps, filters, cooler and bearings, and the circuit that starts the backup pumps." | "Built for one machine system, in depth" |
| **0:40 to 1:05** The investigation | Click **Run investigation**. The agent trace streams in on the left. Pan to the detection badge, the **Filter loading** chip and the **Auto-start readiness: NG** card (47 d / 30 d, 0.10 bar). | "Dimas, the night supervisor, opens the case. Gemini agents pull the signals, run the plant's engineering rules and walk the knowledge graph. Header pressure down, filter pressure up, pump healthy: the filter is loading. And the backup pump's auto-start test is forty-seven days overdue, with just a tenth of a bar of margin left." | "Gemini agents on Google Cloud" |
| **1:05 to 1:20** It refuses to guess | Zoom on the matrix: Man G, Machine NG, Method NG, **Material UNVERIFIED**, Environment UNVERIFIED, each with citation chips. Click **Send evidence request** on Material. | "Everyone's answer is: change the filter. LubeGuard doesn't guess. It checks five possible causes: people, machine, method, material and environment. Each one is proven, or marked unverified. The oil itself is unverified, so it asks the field engineer for one photo." | "Proven, or marked Unverified" |
| **1:20 to 1:52** **HERO: no signal** | **Split screen.** Right: phone, the new task **Oil sample photo from reservoir drain** appears; Joko opens it. Pull down quick settings: **Airplane mode ON** (keep it visible). Tick the checklist steps; tap **Take photo** and photograph the hazy bottle against light; tap **Record voice note** and say "Olinya keruh, seperti susu"; the banner shows **Offline, items queued**. Cut: hands walking up stairs. **Airplane mode OFF**; the phone shows **Syncing**, then **All synced**. Left: laptop, the photo appears in Field evidence, **Material flips to NG**, the root-cause path glows on the skid (cooler E-101A, oil, filter, header, bearing 1). | "Joko is in the turbine basement. No signal. He follows the checklist, photographs the sample and says what he sees. Everything waits safely on his phone. The moment he's back online, it syncs. Gemini judges the photo: the oil is not clear and bright. Free water. And the root cause flips: cooling water is leaking through the oil cooler. The clogged filter was only the symptom." | Subtitle for the voice note: "The oil is cloudy, like milk." Overlay at the flip: "Root cause: cooler E-101A leaking water" |
| **1:52 to 2:12** Act on it | Advisor action cards: quadrant badges, authority, timing, **SOP citation chips**. Click **Approve selected (3)**. Phone: new tasks arrive (filter switch, auto-start test). | "The advisor proposes actions, each citing the plant's own procedures. Switch the filter, isolate the cooler and test the auto-start now, with no downtime. Retube the cooler at the next planned shutdown. Dimas approves, and the tasks go straight to Joko's phone." | "Every step cites the plant's SOP" |
| **2:12 to 2:25** Grounded answers | Open **Ask LubeGuard**: ask "Why is the filter loading?" (answer with citation chips); then "Who won the World Cup?" (shows "0 sources, answer refused"). Quick cut to the **Knowledge Graph** page with the path highlighted. | "Every answer comes from the plant's knowledge graph, with its sources. Ask it anything outside that, and it refuses." | "Grounded, or silent" |
| **2:25 to 2:40** Verified fix | Click **Verify fix**. The chart shows the post-repair region; **Verified effective** appears with the three checks passing. | "And the case only closes when the data proves the fix: header pressure, filter and bearing temperature, all back to baseline." | "Closed on sensor proof" |
| **2:40 to 2:55** Built on Google Cloud | Architecture strip (one slide or overlay): Gemini 3.8 Flash, Agent Development Kit, Cloud Run, BigQuery with TimesFM, Firestore, Cloud Storage, Firebase Auth. If you have live eval numbers, show the table. | "Built on Google Cloud: Gemini agents on Cloud Run, anomaly detection with TimesFM inside BigQuery, and Firestore keeping the engineer's app working offline. [On our test cases, it identified N of M root causes, and every citation is checked in code.]" | Eval table **only with live numbers** |
| **2:55 to 3:02** End card | Logo, tagline, live URL, GitHub repo, theme name, team names. | "Optiflow LubeGuard. From signal to verified fix." | "Manufacturing: Intelligent Operations & Industrial Efficiency" + URL + repo |

Bracketed narration is optional: say it only with real numbers from a live run.

### 3.1 Narration only (teleprompter)

> This bottle just found a leak that nobody was looking for.
>
> In a steam turbine, the bearings ride on a thin film of lube oil. At this plant, the oil header pressure slid for five days. The alarm stayed green, because the pressure never crossed the line. And downtime here costs about thirty thousand dollars an hour.
>
> Optiflow LubeGuard is built for one system: the turbine lube-oil console. It knows its pumps, filters, cooler and bearings, and the circuit that starts the backup pumps.
>
> Dimas, the night supervisor, opens the case. Gemini agents pull the signals, run the plant's engineering rules and walk the knowledge graph. Header pressure down, filter pressure up, pump healthy: the filter is loading. And the backup pump's auto-start test is forty-seven days overdue, with just a tenth of a bar of margin left.
>
> Everyone's answer is: change the filter. LubeGuard doesn't guess. It checks five possible causes: people, machine, method, material and environment. Each one is proven, or marked unverified. The oil itself is unverified, so it asks the field engineer for one photo.
>
> Joko is in the turbine basement. No signal. He follows the checklist, photographs the sample and says what he sees. Everything waits safely on his phone. The moment he's back online, it syncs. Gemini judges the photo: the oil is not clear and bright. Free water. And the root cause flips: cooling water is leaking through the oil cooler. The clogged filter was only the symptom.
>
> The advisor proposes actions, each citing the plant's own procedures. Switch the filter, isolate the cooler and test the auto-start now, with no downtime. Retube the cooler at the next planned shutdown. Dimas approves, and the tasks go straight to Joko's phone.
>
> Every answer comes from the plant's knowledge graph, with its sources. Ask it anything outside that, and it refuses.
>
> And the case only closes when the data proves the fix: header pressure, filter and bearing temperature, all back to baseline.
>
> Built on Google Cloud: Gemini agents on Cloud Run, anomaly detection with TimesFM inside BigQuery, and Firestore keeping the engineer's app working offline. [On our test cases, it identified N of M root causes, and every citation is checked in code.]
>
> Optiflow LubeGuard. From signal to verified fix.

---

## 4. Demo flow (exact click path for recording)

Record the laptop and the phone at the same time (OBS on the laptop, screen recorder or scrcpy on the phone). Do the whole flow in one continuous take; cut it down in editing.

| # | Device | Action (exact UI label) | Expected result | If it goes wrong |
|---|---|---|---|---|
| 1 | Laptop | Open the deployed URL; scroll the landing page slowly | Hero "From signal to verified fix," with the product preview | |
| 2 | Laptop | Click **Enter as Manager** | Incident Room for C-0412; skid diagram with PT-104 1.30 barg, PDT-101 0.89 bar, TE-201 94.0 degC | If a stale case shows, role menu, **Reset demo** |
| 3 | Laptop | Hover the chart, then click **Run investigation** | Trace streams about 10 steps; matrix appears with **Material UNVERIFIED** | If "cached result" appears, stop and fix live AI before recording |
| 4 | Laptop | Click **Send evidence request** on the Material cell | Ticket T-1 linked; bell count rises | |
| 5 | Phone | On **My tasks**, the task **Oil sample photo from reservoir drain** appears; tap it | Task detail with 4 SOP steps (SOP-LO-04 §2) | Pull to refresh or reopen the app |
| 6 | Phone | Pull down quick settings, turn **Airplane mode ON** (keep it in frame) | Offline banner | |
| 7 | Phone | Tap **Pass** on steps 1 to 4 | Steps ticked (saved offline) | |
| 8 | Phone | Tap **Take photo**; photograph the hazy bottle against light | Photo appears in the sync queue as **Queued** | |
| 9 | Phone | Tap **Record voice note**; say "Olinya keruh, seperti susu"; stop | Voice item **Queued**; banner shows items queued | If the mic is blocked, allow microphone in Chrome site settings |
| 10 | Phone | Turn **Airplane mode OFF** | **Syncing**, then **All synced**; photo shows **NG** "not clear and bright" | Bring the app to the foreground to trigger the retry |
| 11 | Laptop | (Already on screen) | Field evidence shows EV-1 photo and EV-2 voice; **Material NG**; Environment NG; root-cause path glows; Advisor actions A1 to A5 | Wait up to 15 s for live judging |
| 12 | Laptop | Click **Approve selected (3)** | Tickets for filter switch (Joko), cooler isolation (Mechanical Shift B), auto-start test (Joko) | |
| 13 | Phone | Open **My tasks** | New tasks visible | |
| 14 | Laptop | Open the **Ask LubeGuard** tab; ask "Why is the filter loading?" then "Who won the World Cup?" | Cited answer, then "0 sources, answer refused" | Use the suggested-prompt buttons |
| 15 | Laptop | Sidebar **Knowledge Graph** | Graph with the root-cause path highlighted | Click **Fit** |
| 16 | Laptop | Back to **Incident Room**; click **Verify fix** | **Verified effective**; three checks pass; post-repair region on the chart | |
| 17 | Laptop | Role menu, **Reset demo** (after recording) | Clean state for the next take | |

Off camera, once: take a photo of the **clear oil** bottle in a second test task and confirm it is judged **G** (clear and bright). This is your negative control for the deck.

---

## 5. Shot list

| Shot | Source | Use in edit |
|---|---|---|
| A. Bottle close-up against light (5 to 8 s, steady, gloved hand) | Phone camera (normal video, not screen recording) | Cold open, hero |
| B. Laptop full screen, the whole flow | OBS | Most of the video |
| C. Phone screen, the whole flow | Phone screen recording or scrcpy | Split screen at the hero |
| D. Hands walking up stairs or through a door with the phone (3 s) | Phone camera | Transition "back online" |
| E. Matrix cell flip (zoomed) | Crop of B | Cold open |
| F. Architecture strip | Slide (Google Slides or Canva) exported as PNG | 2:40 |
| G. End card | Slide | 2:55 |

---

## 6. Editing notes

- Editor: CapCut, DaVinci Resolve or Clipchamp. 1920x1080, 30 fps, H.264 MP4.
- Layout at the hero: laptop left about 62% width, phone right about 38%, both on the dark `#0B0E14` background.
- Zoom and pan (Ken Burns) on the matrix and trace so text is readable on a phone screen; never show more than one dense panel at once.
- Subtitles: burned in, white text on a semi-transparent dark box, bottom centre, max two lines. Captions/overlays in cyan `#06B6D4` with Inter font to match the UI.
- Music: low-volume instrumental from the YouTube Audio Library (copyright-free); duck it under the voice; mute it for the 2 seconds of the matrix flip.
- Sound design: a soft click on the flip and on "All synced" is enough.
- Speed up waiting parts (trace streaming, sync) to 2x, but keep the flip at normal speed.
- Final length 3:00 to 3:02: adjust with the end card.
- Export, watch once on a phone at 50% brightness to check readability.

---

## 7. Upload checklist

- [ ] YouTube upload set to **Public** (or Vimeo public, or Google Drive "anyone with the link"); test the link in a private window
- [ ] Title: "Optiflow LubeGuard: from signal to verified fix (Google Cloud AI Builder Cup 2026)"
- [ ] Description: one-paragraph summary, theme name, live URL, GitHub repo, "Synthetic demo plant; setpoints are not standards", team names
- [ ] Length 3:00 to 3:02
- [ ] No "cached result" badge visible while claiming live AI; no stage codes in narration; numbers match the app and the problem brief
- [ ] Link pasted into the submission form
