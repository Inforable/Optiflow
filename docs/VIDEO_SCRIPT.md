# Demo Video: Script and Demo Flow (Optiflow LubeGuard)

**Format:** a screen recording of the deployed app with a voice-over. No props, no camera, no music needed. Editing is only cutting and speeding up the recording to match the voice-over.

**Length: the submission form requires 3 to 4 minutes.** Target **3:20** (safe margin on both sides).

**The sentence judges should remember:** "It refused to guess, asked the engineer for one photo of the oil, even offline, and found the leak behind the clogged filter."

**Honesty rules**
- Record against the **live** deployment (`/api/health` shows `"aiMode":"live"`). If a **"cached result"** badge appears, the AI step was replayed, not live: re-take, or do not say "Gemini" for that step.
- The photo is the bundled **sample image** (button "Use sample photo (hazy oil)"); the narration says so. In live mode Gemini judges that image for real.
- Offline is simulated with Chrome's **Offline** switch; the narration says so.
- Numbers on screen come from the app or the problem brief; no invented statistics.

---

## 1. Screen setup (one laptop, about 10 minutes)

1. Open the deployed URL in **Chrome**. Click **Enter as Manager**. This is the **Manager window**.
2. In the Manager top bar, click the **join code** (it copies the join link).
3. Open a **second Chrome window**, paste the join link. Press **F12**, then **Ctrl+Shift+M** (device toolbar), pick a phone such as **Pixel 7**. In DevTools, menu **⋮ > Dock side > Undock into separate window**, and move the DevTools window off screen. This is the **Engineer window**: it now looks like a phone, and the device toolbar above it has a throttling dropdown with **Offline**.
4. Arrange: Manager window on the left (about two thirds of the screen), Engineer window on the right (about one third). Browser zoom 100 to 110%. Close other tabs, hide the bookmarks bar, turn off notifications.
5. In the Manager window, open the role menu (top right) and click **Reset demo** for a clean case; refresh the Engineer window so it is on **My tasks** (empty).
6. Recorder: **Windows Snipping Tool** (Win+Shift+R, record the whole screen) or **OBS** (Display Capture, 1920x1080, 30 fps). Record the screen **silently**; the voice-over is recorded afterwards.
7. Do one dry run of section 2, then **Reset demo** and record for real.

---

## 2. Demo flow (what to click, in order)

Do it in one continuous take, slowly. Pause about 2 seconds after each result so you have room to cut.

| # | Window | Click / action | What appears |
|---|---|---|---|
| 1 | Manager | Start on the landing page (navigate to `/`), scroll slowly to the stats band and back up | Hero "From signal to verified fix," |
| 2 | Manager | **Enter as Manager** | Incident Room: lube-oil skid diagram with live tags (PT-104 1.30 barg, PDT-101 0.89 bar, TE-201 94.0 degC), chart below |
| 3 | Manager | Hover the chart (header pressure sliding, alarm line above it) | |
| 4 | Manager | **Run investigation** | Agent trace streams about 10 steps; detection badge, **Filter loading**, **Auto-start readiness NG** (47 d / 30 d, 0.10 bar), exposure US$2.14M |
| 5 | Manager | Scroll to the **4M+1E matrix**; hover the citation chips | Man G, Machine NG, Method NG, **Material UNVERIFIED**, Environment UNVERIFIED |
| 6 | Manager | **Send evidence request** on Material | Ticket T-1 linked |
| 7 | Engineer | Task **Oil sample photo from reservoir drain** appears; tap it | 4 checklist steps citing SOP-LO-04 §2 |
| 8 | Engineer | Device toolbar throttling dropdown: **Offline** | App shows it is offline |
| 9 | Engineer | **Pass** on steps 1 to 4 | Steps ticked (saved offline) |
| 10 | Engineer | **Use sample photo (hazy oil)** | Photo queued |
| 11 | Engineer | (Optional) **Record voice note**, say "Olinya keruh, seperti susu", stop | Voice queued; banner shows items queued |
| 12 | Engineer | Throttling dropdown: **No throttling** (back online) | **Syncing**, then **All synced**; photo shows **NG**, "not clear and bright" |
| 13 | Manager | Watch (no click) | Field evidence appears; **Material flips to NG**; Environment NG; root cause "cooling water leaking through cooler E-101A"; path glows on the skid; Advisor actions A1 to A5 |
| 14 | Manager | Scroll to Advisor actions; hover SOP chips; **Approve selected (3)** | Tickets created for Joko and Mechanical Shift B |
| 15 | Engineer | Back to **My tasks** | New tasks: filter switch, auto-start test |
| 16 | Manager | **Ask LubeGuard** tab: suggested prompt "Why is the filter loading?" | Answer with citation chips |
| 17 | Manager | Ask "Who won the World Cup?" | "0 sources, answer refused" |
| 18 | Manager | Sidebar **Knowledge Graph** (click **Fit** if needed) | Graph with the root-cause path highlighted |
| 19 | Manager | Sidebar **Incident Room**; **Verify fix** | **Verified effective**, three checks pass, post-repair region on the chart |
| 20 | Manager | Sidebar **Tickets** (briefly) | Ticket list with statuses and AI or Human chips |
| 21 | Manager | Navigate back to the landing page, scroll to "Built on Google Cloud and Gemini" | End frame; the URL is visible in the address bar |

If the voice note microphone prompt appears, allow it. If anything stalls more than 20 seconds, keep recording and cut it later.

---

## 3. Voice-over script (timed to the flow)

Read at a calm pace (about 150 words per minute). Total about 440 words, about 2:55 of speech; with pauses the cut lands near 3:20. Record it after the screen recording, watching the footage, one paragraph per segment.

| Time | Flow steps | Voice-over |
|---|---|---|
| **0:00 to 0:22** | 1 | "In a steam turbine, the bearings ride on a thin film of lube oil. If that oil system degrades slowly, nobody notices until a bearing is damaged. In this plant's case, the lube-oil header pressure slid for five days and the alarm never fired. Downtime here costs about thirty thousand dollars an hour. This is Optiflow LubeGuard." |
| **0:22 to 0:40** | 2, 3 | "LubeGuard is built for one system, in depth: the turbine lube-oil console. It knows the pumps, the filter, the cooler, the bearings, and the circuit that starts the backup pumps. Here is the header pressure, sliding toward the alarm line, still green." |
| **0:40 to 1:10** | 4 | "Dimas, the maintenance supervisor, runs the investigation. Gemini agents pull the signals, run the plant's engineering rules and walk the knowledge graph. Header pressure is down, filter pressure is up, and the pump is healthy, so the filter is loading. It also finds that the backup pump's auto-start test is forty-seven days overdue, with only a tenth of a bar of margin left." |
| **1:10 to 1:30** | 5, 6 | "Most teams would just change the filter. LubeGuard doesn't guess. It checks five possible causes: people, machine, method, material and environment. Each one is proven with a cited source, or marked unverified. The oil itself is unverified, so it sends the field engineer an evidence request." |
| **1:30 to 2:12** | 7 to 13 | "On the right is Joko's engineer app. In a turbine basement there's often no signal, so we switch the app offline. He follows the checklist from the plant's procedure and attaches a photo of the oil sample. For this demo we use a sample image. Everything waits safely on the phone. When he's back online, it syncs, and Gemini judges the photo: the oil is not clear and bright, which means free water. Now the root cause changes. Cooling water is leaking through oil cooler E-101A. The clogged filter was only the symptom." |
| **2:12 to 2:35** | 14, 15 | "The advisor proposes actions, and every step cites the plant's own SOP. Switch the filter, isolate the cooler and test the auto-start now, with no downtime. Retube the cooler at the next planned shutdown. Dimas approves three actions, and the tasks go straight to Joko." |
| **2:35 to 2:55** | 16 to 18 | "Every answer comes from the plant's knowledge graph, with its sources, like this explanation of why the filter is loading. Ask it something outside the plant, and it refuses instead of making something up." |
| **2:55 to 3:08** | 19, 20 | "And the case only closes when the data proves the fix: header pressure, filter pressure and bearing temperature are back to baseline." |
| **3:08 to 3:20** | 21 | "LubeGuard runs on Google Cloud: Gemini agents built with the Agent Development Kit on Cloud Run, anomaly detection with TimesFM in BigQuery, and Firestore keeping the engineer's app working offline. Optiflow LubeGuard: from signal to verified fix." |

---

## 4. Editing (cuts and speed only)

1. Import the screen recording and the voice-over into any editor (CapCut, Clipchamp, DaVinci Resolve).
2. Lay the voice-over on the timeline first. Then cut the screen recording into the segments in section 3 and line each one up under its paragraph.
3. **Cut** dead time: page loads, mouse wandering, the dry seconds before sync.
4. **Speed up** (1.5x to 3x) the trace streaming, scrolling and syncing so each segment matches its voice-over length. Keep the **Material flip** (step 13) at normal speed.
5. Make sure the final video is **between 3:00 and 4:00** (target 3:20). If it is short, slow the screen segments slightly or hold on the Incident Room for a few seconds; if long, speed up scrolling.
6. Export 1080p MP4. Watch it once on a phone to check the text is readable; if not, add a quick zoom (crop) on the matrix and the evidence card.

---

## 5. Upload checklist

- [ ] Length between **3:00 and 4:00**
- [ ] Upload to YouTube as **Public** (or Vimeo public, or Google Drive "anyone with the link"); open the link in a private window to test
- [ ] Title: "Optiflow LubeGuard: from signal to verified fix (Google Cloud AI Builder Cup 2026)"
- [ ] Description: one-paragraph summary, theme name, live URL, GitHub repo, "Synthetic demo plant; setpoints are not standards"
- [ ] No "cached result" badge on screen while the narration says the AI did it live
- [ ] Link pasted into the form field **Demo Video Link (3-4 minutes)**
