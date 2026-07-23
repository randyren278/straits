# Hyperframes Composition Brief: Tanker Tracker

## Objective
Create a short, cinematic launch-style brag video for Tanker Tracker — a real-time Middle East oil-tanker intelligence dashboard.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: /Users/randyren/Developer/tanker-tracker
- Primary files read: src/app/globals.css, src/app/layout.tsx, src/components/map/VesselMap.tsx, src/components/panels/VesselPanel.tsx, README.md
- Real screenshots to reference/composite (in repo): `docs/screenshots/dashboard.png`, `docs/screenshots/dashboard-detail.png`, `docs/screenshots/fleet.png`, `docs/screenshots/analytics.png`
- Product name: Tanker Tracker
- Tagline / strongest claim: "The oil war, in real time." + "Zero paid API keys."
- Key UI to recreate/composite: the dark Gulf map with amber chokepoint boxes and color-coded vessel dots; the VESSEL DETAIL risk-score dossier panel.
- Copy that must appear verbatim:
  - TANKER TRACKER
  - LIVE
  - STRAIT OF HORMUZ
  - VESSEL DETAIL
  - RISK SCORE
  - 140 VESSELS TRACKED
  - 16 SANCTIONED
  - 24 ACTIVE ANOMALIES
  - Zero paid API keys.
  - the oil war, in real time.

## Creative Direction
- Tone preset: cinematic
- Creative direction: "declassified maritime-intelligence terminal booting up"
- Interpretation: big monospace type, dramatic-but-restrained reveals, deep black negative space, confident holds. Tension, not chaos.
- Angle: A personal project that looks and behaves like a Bloomberg/Palantir-grade ops console — the Gulf lighting up with contacts, then one sanctioned tanker getting "made" with a full risk dossier.
- Hook: black screen → amber cursor blip → TANKER TRACKER types as the Gulf map resolves and vessel dots ignite → the word LIVE.
- Outro / punchline: near-black terminal → "Zero paid API keys." → "TANKER TRACKER — the oil war, in real time." with a blinking cursor.
- Avoid: generic SaaS language, abstract filler visuals, unrelated redesign, strobing, game-ad energy.

## Visual Identity
- Background: true black `#000000`
- Text: white `#ffffff`, secondary gray `#6b7280`
- Accent: amber `#f59e0b`
- Display font: JetBrains Mono (the app uses monospace exclusively)
- Body font: JetBrains Mono
- Visual references from the project: dark CARTO Gulf map; amber dashed chokepoint boxes; color-coded circle contacts (red=going-dark/sanctioned, purple=shadow-fleet, orange=loitering, amber=tanker, gray=other); VESSEL DETAIL panel with horizontal risk-factor bars.

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Boot / hook — 3s — black → cursor → TANKER TRACKER types, Gulf map resolves, dots ignite, "LIVE".
2. The board — 4s — full Gulf map, 140+ contacts, amber chokepoint boxes labeled; "All vessels. Middle East. Near real-time."
3. Lock-on (centerpiece) — 5s — cursor clicks a Hormuz contact → VESSEL DETAIL dossier slides in (SILVER TRIUMPH, IMO, flag, RISK SCORE bars fill).
4. The stats — 4s — three cards one-by-one: 140 VESSELS TRACKED / 16 SANCTIONED / 24 ACTIVE ANOMALIES, numbers count up.
5. Flex + outro — 4s — "Zero paid API keys." (subline: live AIS · FRED · OpenSanctions · keyless map) → "TANKER TRACKER — the oil war, in real time." cursor blinks.

Prefer compositing the real screenshots (`docs/screenshots/dashboard.png` and `docs/screenshots/dashboard-detail.png`) for scenes 2 and 3 so the actual product UI is on screen, with amber monospace overlays and a simulated cursor. Scenes 1/4/5 can be pure HTML/CSS in the project's palette.

## Audio
- Audio role: cinematic support — low maritime-ops tension bed with a rising swell into the dossier lock-on.
- Audio arc: quiet under the boot hook → rising across the live board → swell + strong hit on the vessel-detail lock-on → three ticks on the stat cards → fade under the outro line.
- Music: choose a cinematic/tension bed from bundled tracks.
- Music treatment: quiet start, swell into scene 3, fade-out under the final terminal line.
- Music cue guidance: detect cues at composition time (`npx hyperframes beats` or analyze script). Lock one strong cue on the dossier appearing (~10-12s); beat-grid the 3 stat cards in scene 4.
- Audio-reactive treatment: subtle — chokepoint-box glow and dossier-panel presence breathe with music RMS. No waveform/EQ bars, no particles.
- Audio-coupled moments:
  - Scene 1 — title typing key ticks; radar blips on dot ignition.
  - Scene 3 — "acquire/lock" cue on dossier slide-in; soft ticks as risk bars fill (beat-locked strong cue).
  - Scene 4 — three ticks, one per stat card (beat-grid).
  - Scene 5 — one soft blip on the final blinking cursor; music fades.
- SFX selection guidance: sparse and motion-matched — radar/sonar blip for contacts, a low "lock" cue for the dossier, clean ticks for stat cards. Restraint over density.
- SFX analysis guidance: use `skills/brag/assets/sfx/sfx-analysis.md` if present; prefer low high-frequency-risk files for repeated blips/ticks.
- Exact SFX choice: Hyperframes chooses filenames, timestamps, density, and volume from the implemented animation.
- Audio files: copy chosen music and SFX into `brag-output/composition/assets/`.

## Hyperframes Instructions
Use the current `hyperframes` skill and CLI workflow. Prefer native Hyperframes conventions.

Requirements:
- Show at least one real UI element from the project — composite the actual screenshots for scenes 2 and 3.
- Keep all text readable (monospace holds: short labels ~0.8s, the hook/outro lines longer).
- Keep the video within 15-25 seconds (target 20).
- Include the planned music/SFX layer.
- Treat audio notes as guidance; choose SFX after the animation exists.
- 1-3 strong cue locks max; beat-grid the stat cards; readability first.
- Subtle audio-reactive glow on chokepoint boxes / dossier panel; no EQ bars.
- Use local assets for audio and any runtime dependencies.
- Run `npx hyperframes lint` and validate before render.
