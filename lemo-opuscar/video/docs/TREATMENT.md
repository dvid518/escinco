# TREATMENT — escinco Pitch Audiovisual (30 s)

**Style:** Dark Tech Keynote (`dark-keynote`)  
**Topic:** escinco — financial clarity dashboard  
**Length:** 30 seconds exactly (36s rendered with generous gaps for trim)  
**Resolution:** 1920 × 1080 @ 24 fps  
**Language:** Español latinoamericano neutro  
**Voice:** Female, professional, warm, natural (edge-tts `es-MX-GuadalupeNeural` or `es-AR-ElenaNeural`)  
**Music:** Minimal ambient electronic, tuned percussion (marimba/vibraphone), one brand accent colour, ducking −8 dB under voice  
**Subtitles:** Burned-in toast pills, bottom-centre, Inter 500, 40 px, accent dot  

---

## 1. Three Candidate Structures

### Structure A: **The Ordered Reveal** (chosen)
**Hook (0–1 s):** Extreme close-up on the escinco asterisk (brand mark) on black. A single typed line appears: *"¿Cuánto dinero te pertenece realmente?"* — typed by an invisible cursor, one character per frame, in silence.

**Problem (1–8 s):** Continuous pull-back from ×4 to ×1 over 4 bars (120 BPM = 0.5 s/bar). Each bar adds a layer of generated UI "financial noise":
- Bar 1: Account cards spawn (drop + bounce, 0.22 s) — scattered positions, slight rotation
- Bar 2: Currency symbols (PEN, USD, EUR, USDT) fling in from off-screen
- Bar 3: Transaction rows slide from right (0.24 s) — ingresos/egresos mixed
- Bar 4: Investment tickers, debt badges, pending pills — all trembling ±2 px, dutch angle + wobble building

**Overload inserts (7.5–8 s):** Three half-second UI expands from source positions: 999+ unread badge, 148-tab strip, red storage bar. Sound: scattered family (detuned, random pans).

**Freeze + Silence (8.0–8.5 s):** Digital zero on all tracks. Push-in through frozen mess onto the asterisk (×0.8 → ×2.5).

**The One Action (8.5–9 s):** Whip pull-out in one beat (×2.5 → ×0.7). The asterisk *presses* — 2 frames squash (height ×0.3, width ×2.4). All noise elements launch along curved paths to their type-rows (accounts → grid, currencies → toggle, transactions → list, investments → chart) morphing into uniform snap tiles. Grid slot outlines light in brand accent. Single chord lands (A major 9).

**Light Reveal (9–11 s):** The real escinco dashboard window rotates in from −24° → 0° over 2 s while a soft light band sweeps across (1.3 s). Camera static. Only lit pixels turn on. Unlit areas at 7%.

**Patrimonio Counter (11–13 s):** Dive into the patrimonio card (log-zoom to ×12). Match cut to full-screen giant number: **S/ 13,400.00** scrambling from glyph noise, digits locking right-to-left on sixteenth notes (0.5 s each = 2 s total), each with damped bounce. Camera holds.

**Chart Draw (13–17 s):** Pull back to dashboard. The evolution chart (14 days from fixture) draws progressively: axis grows with narration naming the unit; points land on beat with pop + ripple; line connects with staggered sweep. Camera tracks pencil-style: newest point at ~60% width.

**Secondary Indicators (17–23 s):** Sequential spawns (one per beat): cuentas/divisas pills → ingresos/egresos bars → distribución donut → inversiones tiles → metas progress rings. Each: slide-in + morph, overshoot along tangent, settle on grid.

**Breath (23–25 s):** Slow push (×1.08). UI puts itself away: sidebar, status bar, headers retract one per beat. Window rim lights in accent. Window collapses vertically like CRT-off (0.22 s) into the asterisk.

**Close (25–30 s):** Empty grid, only asterisk lit in accent. Cursor types `escinco` → `escinco.com`. Narrator: *"¿Cuánto dinero te pertenece realmente?"* (voice only, no caption over the question). Asterisk blinks twice, goes out. Digital silence.

**Why this structure:** It maps the style's native moves directly to the brief's required beats. The "generated accumulation → snap grid → light reveal → giant number → put-away" arc is the style's signature grammar. The asterisk serves as both brand mark and the "living element" (cursor substitute). The real dashboard is the hero, rendered faithfully via `litShape` from captured DOM.

---

### Structure B: **The Question Opens**
**Hook (0–2 s):** Full-screen giant question typed by cursor: *"¿Cuánto dinero te pertenece realmente?"* — no UI, just text on black. Voice begins immediately.

**Problem (2–9 s):** As narrator describes confusion, generated financial elements accumulate *around* the question text (not pull-back). They push the question off-screen by 8 s.

**Transition (9 s):** Freeze + silence. Question text becomes the "press point" — it compresses into the asterisk.

**Solution (9–26 s):** Light reveal of real dashboard. Counter, chart, indicators as in Structure A.

**Close (26–30 s):** Question returns as typed text beneath `escinco.com`. Narrator repeats it.

**Why not chosen:** The brief requires the question at the *end* as the emotional peak. Opening with it front-loads the turn. Also loses the style's signature "accumulation pull-back" which is its most cinematic move.

---

### Structure C: **Side-by-Side Comparison**
**Hook (0–1 s):** Split screen: left = generated mess (dark, red accents), right = empty grid.

**Problem (1–8 s):** Left side accumulates faster and faster; right side stays empty. Sound: phasing marimbas (left drifts).

**Transition (8 s):** Center press — both sides collapse toward center.

**Solution (8–25 s):** Merged view becomes real dashboard. Counter, chart, indicators.

**Close (25–30 s):** Right-side grammar: clean grid, asterisk, URL, question.

**Why not chosen:** Split screen halves the resolution for the real dashboard (the brief's "prioridad técnica absoluta"). The style's "side by side" native move is for old vs. new workflow — not problem vs. solution. Wastes the single-screen precision the style is built for.

---

## 2. Logline & Arc
**Logline:** *Financial chaos resolves into one clear number — the money that's truly yours.*

**Setup (0–8 s):** Generated UI noise = the problem (scattered accounts, currencies, debts, investments). Sound = scattered family, phasing.

**Turn (8–9 s):** Freeze → silence → the asterisk presses → snap grid → light reveal. Sound = single chord, ordered family.

**Ending (9–30 s):** Real dashboard hero. Counter → chart → indicators → put-away → asterisk + URL + question. Sound = subtractive process (notes removed bar by bar until one quarter note).

---

## 3. Benchmark
**Learn from:** Apple "Room to Think" (Tidy demo) — accumulation pull-back, snap grid, light reveal, giant number, put-away, cursor as protagonist.  
**Don't take:** Tidy's fictional UI, lime accent, specific spawn timings, 264 elements, phasing score structure.

**Learn from:** Linear/Stripe launch videos — snap-grid precision, one accent, 1 px lines, 2.5D window rotation.  
**Don't take:** Their interfaces, fonts, melodies, product verbs.

---

## 4. Shot List

| # | Segment | Framing | Camera Move | Duration | Why |
|---|---------|---------|-------------|----------|-----|
| 1 | Hook | Extreme CU (asterisk ~150 px) | Locked, barely perceptible push ×1.04 | 1 s | Intimacy; the question is typed, not spoken yet |
| 2–5 | Problem accumulation | Full → wide | **Continuous pull-back** ×4 → ×1, keyed per bar (log space), 1–2° dutch + wobble building | 7 s | Scale of the problem grows with the camera; each bar = one financial dimension |
| 6 | Overload inserts | CU per insert | **UI expand** from source (0.5 s each) | 1.5 s | Overload felt as UI breaking frame; no fades |
| 7 | Freeze | CU on asterisk | Push-in ×0.8 → ×2.5, ease-in-out | 0.5 s | Time stopped; digital silence |
| 8 | Press + Collapse | Wide | **Whip pull-out** ×2.5 → ×0.7 (1 beat) | 0.5 s | See both press point and whole grid landing |
| 9 | Light Reveal | Full window | Static camera; window rotY −24°→0°; light sweep 1.3 s | 2 s | Product as hero; only lit pixels turn on |
| 10 | Patrimonio Counter | Extreme CU (number ~400 px) | Log-zoom dive to ×12 → match cut to full-screen | 2 s | The one number gets its own screen |
| 11 | Chart Draw | Medium (dashboard) | Track: newest point at 60% width; axis grows with narration | 4 s | Progress: past behind, future ahead |
| 12–16 | Secondary Indicators | Medium → CU per card | Sequential spawns (slide-in + morph, overshoot) | 6 s | One idea per beat; hierarchy clear |
| 17 | Breath | Wide | Slow push ×1.08 | 2 s | UI puts itself away; music subtracts |
| 18 | Close | Extreme CU (asterisk) | Locked; CRT-off collapse into asterisk | 5 s | Echo of opening; question lands in voice only |

---

## 5. Beat Sheet (second by second)

| Time | Visual | Audio | Subtitle |
|------|--------|-------|----------|
| 0.0–1.0 | Asterisk on black. Cursor types: *"¿Cuánto dinero te pertenece realmente?"* | Silence. Cursor tick per char. | (none — typed text is its own subtitle) |
| 1.0–2.0 | Bar 1: Account cards drop + bounce (12 cards) | Marimba voice 1 (on grid). Files plop. | — |
| 2.0–3.0 | Bar 2: Currency symbols fling in (PEN, USD, EUR, USDT) | Vibraphone voice 2 (unison). Photo flick. | — |
| 3.0–4.0 | Bar 3: Transaction rows slide right (ingresos/egresos mixed) | Glockenspiel voice 3 (drifting). Notification glass. | — |
| 4.0–5.0 | Bar 4: Investment tickers, debt badges, pending pills. Dutch + wobble. | Pad gains dissonance. Coil whine rises. | — |
| 5.0–6.0 | Tremble ±2 px intensifies. | Low sine pulse: eighths → sixteenths. | — |
| 6.0–7.0 | Mess at peak. | All voices dense. Shaker. | — |
| 7.0–7.5 | Insert 1: 999+ badge expands. | Glitch accent. | — |
| 7.5–8.0 | Insert 2: 148-tab strip. Insert 3: Red storage bar. | Storage buzz. | — |
| 8.0–8.5 | **DIGITAL SILENCE**. Push-in on asterisk. | **Zero on all tracks**. | — |
| 8.5–9.0 | Asterisk presses (2-frame squash). Whip pull-out. Collapse: elements fly to type-rows along curved trails (accent glint on grid slots). | **Press chord**: felt mallet + 55→40 Hz sine drop. All voices land on A maj 9. Grid ticks (felt). | — |
| 9.0–11.0 | Window rotates in (−24°→0°). Light sweep (1.3 s). Dashboard fully lit. | Bowed vibraphone carries chord (L-cut). Light shimmer (J-cut 0.4 s). Room ambience. | *"escinco reúne tus cuentas, inversiones y deudas en un solo lugar."* |
| 11.0–13.0 | Dive to patrimonio card. Match cut: **S/ 13,400.00** scrambles from glyph noise, digits lock on sixteenths (0.5 s each), damped bounce. | Number chord rings. Digit grains per lock. Music ducks −8 dB. | *"Tu patrimonio total: trece mil cuatrocientos soles."* |
| 13.0–14.0 | Pull back. Y-axis grows as narrator names unit. | Axis ruler hiss. | *"En los últimos catorce días..."* |
| 14.0–15.0 | Point 1 lands (pop + ripple). | Plonk (pitch = value). | — |
| 15.0–16.0 | Points 2–5 land on beat. Line connects (staggered sweep). | Plonk sequence. | *"...la tendencia es ascendente."* |
| 16.0–17.0 | Points 6–14 land progressively. Camera tracks. | Dense passage: quieter, decay ≤ 1.5× gap. | — |
| 17.0–18.0 | Cuentas/divisas pills slide in. | Felt tick + glass tap. | *"Cuentas en soles, dólares, euros."* |
| 18.0–19.0 | Ingresos/egresos bars morph in. | Felt tick. | *"Ingresos y egresos separados."* |
| 19.0–20.0 | Distribución donut draws (morph bars→waffle). | Ratchet click per segment. | *"Distribución: liquidez, inversiones, inmovilizado, deudas."* |
| 20.0–21.0 | Inversiones tiles (BTC, VOO) snap in. | Felt tick. | *"Bitcoin y VOO con valor actual."* |
| 21.0–22.0 | Metas progress rings (Viaje, Emergencia). | Felt tick. | *"Metas de ahorro con progreso real."* |
| 22.0–23.0 | Hold full dashboard. | Pad sustains. | — |
| 23.0–24.0 | Sidebar retracts. | Subtractive: one note removed. | — |
| 24.0–25.0 | Status bar, headers retract. Window rim lights accent. CRT-off collapse into asterisk. | CRT-off. Pattern subtracts bar by bar. | — |
| 25.0–26.0 | Empty grid. Asterisk lit in accent. Cursor types `escinco`. | Near-silence (−60 dB room). Cursor tick. | — |
| 26.0–27.0 | Cursor types `escinco.com`. | Cursor tick. | — |
| 27.0–29.0 | Hold. Narrator: *"¿Cuánto dinero te pertenece realmente?"* | Voice only. Music gone. | *"¿Cuánto dinero te pertenece realmente?"* (toast) |
| 29.0–30.0 | Asterisk blinks twice → out. Digital silence. | Digital zero. | — |

---

## 6. Cue Map

**Tempo:** 120 BPM (0.5 s/beat, 24 fps = 12 frames/beat)  
**Grid:** 4/4, finest subdivision = sixteenth (3 frames). 1440 frames/min divides evenly.

| Section | Bars | Tempo Action | Instrumentation |
|---------|------|--------------|-----------------|
| Hook | 2 | — | Silence + cursor tick |
| Accumulation | 8 | Add one voice per bar | Bar 1: marimba (grid) | Bar 2: +vibraphone (unison) | Bar 3: +glockenspiel (drift) | Bar 4: +pad (dissonance) |
| Overload | 2 | Sixteenths accelerate | Low sine pulse: eighths → sixteenths. Shaker. |
| Freeze | 1 | **Digital silence** | — |
| Press | 1 | All voices realign | Felt mallet + sine drop. A maj 9 chord (all voices). |
| Reveal | 4 | Chord rings (L-cut) | Bowed vibraphone. Light shimmer. |
| Counter | 4 | Sixteenth-note locks | Digit grains. Number chord. |
| Chart | 8 | Steady | Plonk sonification (pentatonic → semitone). |
| Indicators | 12 | One spawn per beat | Felt tick + glass tap per element. |
| Breath | 4 | **Subtractive** | Pattern loses one note/bar until one quarter note. |
| Close | 4 | Near-silence | Room only. Cursor ticks. Final silence. |

**Key cues (must land on beat):**
- 8.0 s: Digital silence starts (bar 13 downbeat)
- 8.5 s: Press chord (bar 14 downbeat)
- 9.0 s: Light sweep starts (bar 14 beat 3)
- 11.0 s: Counter dive (bar 17 downbeat)
- 11.5–13.0 s: Digit locks (sixteenths)
- 13.0 s: Axis grow (bar 19 downbeat)
- 17.0–23.0 s: Indicator spawns (bars 21–26 downbeats)
- 23.0 s: Subtractive starts (bar 27 downbeat)
- 25.0 s: CRT-off (bar 29 downbeat)
- 27.0 s: Question spoken (bar 30 beat 3)
- 29.0 s: Final silence (bar 32 downbeat)

---

## 7. Sound Design Table

| Section | Ambience Bed | Main Foley | Music State |
|---------|--------------|------------|-------------|
| Hook (0–1) | — | Cursor tick (per char) | Silence |
| Accumulation (1–8) | Quiet room + fan (held back) + coil whine (grows) | Files plop, photo flick, notification glass, window whoosh | Phasing build: marimba + vibraphone + glockenspiel + pad + sine pulse + shaker |
| Overload (7–8) | Fan/whine peak | Glitch accents, storage buzz, stacking thumps | Dense, scattered family (detuned ±45¢, random pans) |
| Freeze (8–8.5) | **Digital zero** | **Digital zero** | **Digital zero** |
| Press (8.5–9) | — | Press "doom" (felt mallet + 55→40 Hz sine), grid ticks | All voices → A maj 9 chord |
| Reveal (9–11) | Room (low) | Light-sweep shimmer, window whoosh | Bowed vibraphone (L-cut), then clean pattern |
| Counter (11–13) | Room (low) | Digit grains, small bounce per lock | Number chord (rings L-cut) |
| Chart (13–17) | Room | Axis ruler hiss, plonk per point | Plonk sonification (pentatonic → semitone), decay ≤ 1.5× gap |
| Indicators (17–23) | Room | Felt tick + glass tap per spawn | Same pattern, one element per beat |
| Breath (23–25) | Room (fading) | Retract thumps (one per beat), CRT-off | Subtractive: notes removed bar by bar |
| Close (25–30) | −60 dB room | Cursor ticks (2), asterisk blink (soft) | Near-silence → digital zero |

**Silences (verified):**
1. **8.0–8.5 s**: Digital zero on all tracks (freeze). First sound after = press chord.
2. **29.0–30.0 s**: Digital zero (asterisk out). First sound after = none (film ends).

**J/L cuts:**
- J: Light shimmer starts 0.4 s before light sweep (under chord tail)
- L: Press chord rings into reveal (bowed vibraphone)
- L: Number chord rings into chart (plonk)
- J: Subtractive pattern starts under last indicator spawn

---

## 8. Subtitle & Title Design

**Caption component (toast):** `rgba(12,14,19,.72)` pill (`.88` during mess), 1 px `rgba(255,255,255,.09)` border, Inter 500 40 px `#E8EAF0`, 8 px accent dot (brand colour), 12 px rise + fade in 0.16 s. Hold ≥ max(1.8 s, speech + 0.6 s).

**Placement:** Bottom-centre. Dashboard window lifted 25 px while captions up.

**Typed text in frame:** The opening question and closing `escinco` / `escinco.com` are typed by cursor in frame → only in `.srt`, not burned.

**Brand accent colour:** Extract from escinco logo SVG — the asterisk uses `currentColor` (inherits `--text` = `#E8EAF0` in dark). But the style needs a *saturated* accent. Use **`#00a269`** (teal mint, from escinco's `--tropicalMint` / `--verdigris` family) — distinct from UI neutrals, visible on dark stage.

**Window lift:** +25 px during captions (per style pitfall).

---

## 9. Engine Integration (faithful dashboard rendering)

**Core challenge:** Render the *real* escinco dashboard HTML/CSS in the Dark Tech Keynote engine.

**Approach:**
1. **Capture DOM** of the live demo dashboard at 1920×1080 (headless Chromium via Playwright, same as style's renderer).
2. **Extract computed styles** for each card: position, dimensions, colours, fonts, borders, shadows, canvas chart image.
3. **Reconstruct in engine.js** using `litShape` for each card surface:
   - `panel()` for card backgrounds (rounded, 1 px border, inner highlight, soft shadow)
   - `litShape()` for text/values (using captured font metrics, colours)
   - Chart canvas → draw as texture on `litShape` with `sweep` for progressive reveal
4. **Animate via engine:** counter scramble (`scramble`), chart draw (custom `plotShape` + `morphMark`), indicator spawns (`flyPose` with `motionBlur`).
5. **Light reveal:** Render full dashboard to offscreen canvas, then `lightReveal()` with `sweep` 0→1.
6. **CRT-off collapse:** `perspective()` on dashboard canvas, vertical squash with tint.

**Fidelity checks:**
- Font: Inter (variable) + Roboto Mono — match exactly via `font(px, wt, fam)` helpers
- Colours: CSS variables → hex mapping (--background `#0A0B0F`, --surface `#12151C`, --border `rgba(255,255,255,.08)`, --text `#E8EAF0`, --positive `#96FFA1`, --negative `#FE8F8F`)
- Spacing: 24 px card padding, 16 px gap, 20 px border-radius
- Shadows: `--glow` replicated via `panel()` shadow params

**Fallback if DOM capture fails:** Static screenshot of dashboard → `litShape` with `sweep` reveal only (no progressive chart draw). But the brief demands "reutiliza 100% estilos y estructura HTML originales" — so DOM capture is mandatory.

---

## 10. Production Plan

1. **Week 1:** Write `timeline.js` (tempo grid, pattern, voices, key times) → `dump_timeline.mjs` → hand to music sub-agent. Build engine dashboard renderer (DOM capture → `litShape` reconstruction).
2. **Week 2:** Build mess generator (generated UI noise from note tables). Build collapse (snap grid flights with trails). Build light reveal + counter scramble + chart draw + indicator spawns. Build breath/put-away.
3. **Week 3:** TTS (edge-tts) → whisper → score stems → mix (ducking, silences, J/L) → srt. Cue check (`cuecheck.py`). Render frames → mux (−14 LUFS, grain 0).
4. **Review:** `still.mjs` at 0.5 s intervals + sheet.py at key frames (collapse, press, counter, chart, close). Frame strips of collapse and press.

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| DOM capture doesn't match live demo exactly | Use same Playwright config as style's renderer; capture at 2× for retina, downscale. Verify pixel-perfect against demo.html in browser. |
| Chart progressive draw looks different from Chart.js | Export chart canvas at each animation frame from real Chart.js instance; use as texture sequence in engine. |
| Subtractive music pattern doesn't land cleanly | Write score.py first; verify on decoded samples before render. |
| Voice masks fan/coil whine | Hold ambience −20 dB until last VO line ends (per style pitfall). |
| Caption toasts clip dashboard bottom | Lift dashboard window +25 px while captions active (engine: `camera({sy: -25})` during toast). |
| 30 s exact duration | `timeline.js` defines every key time; render checks `duration === 30.0` ±0.04 s. |

---

**Chosen structure:** **A — The Ordered Reveal**  
**Next step:** Write `timeline.js` and begin engine dashboard renderer.  
**Storyboard:** Rendered 6 key frames with real engine code per DIRECTOR.md §5 (approved).