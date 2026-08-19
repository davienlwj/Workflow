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

- **Log** — record either an **interval session** (Norwegian 4x4: intervals
  completed, per-interval avg/peak HR and actual duration, recovery quality)
  or an **easy run** (duration, distance, avg/max HR) — plus session RPE, an
  optional VO2max reading, and notes, shared by both. Each interval's
  duration input defaults to the protocol's planned work time but is
  editable per rep, for when an actual set ran long or short.
- **History** — every session, tap one to edit or delete it. From there,
  *Add to Calendar* downloads a standard `.ics` file for that session (date,
  intervals, HR, RPE, notes) that Apple Calendar, Google Calendar, or
  Outlook can all import directly — no account or sync setup involved.
- **Progress** — sessions logged (interval + easy run combined), current
  week of the block, average interval HR, days since your last session, a
  VO2max trend chart, and a 16-slot block checklist that fills in as you log
  interval sessions — easy runs are tracked but don't count toward the
  block, since they're not part of the 4x4 protocol.
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
js/ics.js                   builds a per-session .ics file for calendar export
js/app.js                   rendering and events
sw.js                        offline cache
tools/gen-icons.mjs          draws the icons, no dependencies
../tests/vo2max-*.test.mjs   zone, block-math and ics-export test suites
```
