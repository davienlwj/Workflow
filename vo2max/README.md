# VO2max Tracker

A personal training log for a Norwegian 4x4 VO2max block. No account, no
server — everything is stored in `localStorage` on your device, and the app
keeps working offline once it has loaded once.

## Put it on your Home Screen

Served over HTTPS (or `localhost`), from this folder specifically —
`/vo2max/` is its own installable app, separate from the calendar at the
repo root.

**iPhone / iPad** — open `/vo2max/` in Safari, tap Share, then *Add to Home
Screen*. It launches full screen with no browser chrome.

**Android** — open in Chrome, tap the ⋮ menu, then *Add to Home screen*.

If this repo is deployed via `.github/workflows/pages.yml`, the app lives at
`https://<username>.github.io/<repo>/vo2max/`.

### Running it locally

```sh
python3 -m http.server 8000        # then open http://localhost:8000/vo2max/
npm test                            # runs this app's tests alongside the calendar's
npm run icons:vo2max                # regenerate the app icons
```

## What's in it

- **Log** — record a session: date, intervals completed, per-interval avg +
  peak HR, recovery quality, session RPE, an optional VO2max reading, notes.
- **History** — every session, tap one to edit or delete it.
- **Progress** — sessions logged, current week of the block, average
  interval HR, days since your last session, a VO2max trend chart, and a
  16-slot block checklist that fills in as you log.
- **Zones** — both the LTHR-based and RHR-based (Karvonen) zone tables, the
  interval target zone highlighted, and a protocol quick-reference card.
- **Settings** — every number above (baseline VO2max, resting/max/threshold
  HR, protocol start date, which zone model is primary, and all of the
  protocol's reps/timing/frequency/block length) is editable here — nothing
  is hardcoded once you've changed it. Export/import a JSON backup, or reset
  to defaults.

## Zone math

Both zone tables are computed live from your HR settings, not stored as
fixed numbers:

- **LTHR-based** — each zone is a percentage band of lactate threshold HR.
- **RHR-based** — the Karvonen heart-rate-reserve formula:
  `restingHR + %*(maxHR - restingHR)`.

Zones are built as contiguous bands (one zone's top is the next zone's
bottom minus one), which is why the displayed bpm ranges land exactly on
values like 146–158 rather than whatever a lone `round()` of each bound
would give. `../tests/vo2max-zones.test.mjs` pins the exact bpm bands for
the defaults in this app.

## Layout

```
index.html                 markup and the two sheets (edit-session, none else)
css/style.css               the whole dark theme
js/store.js                 localStorage CRUD for settings and sessions
js/zones.js                 zone tables, computed from settings
js/block.js                 current week, checklist, stats — pure functions
js/chart.js                 dependency-free SVG line chart for the VO2max trend
js/app.js                   rendering and events
sw.js                        offline cache
tools/gen-icons.mjs          draws the icons, no dependencies
../tests/vo2max-*.test.mjs   zone and block-math test suites
```
