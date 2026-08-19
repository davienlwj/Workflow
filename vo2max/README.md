# VO2max Tracker

A personal training log for the Norwegian 4x4 VO2max protocol. No account, no
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

- **Dashboard** — a month calendar is the main way in: days with a logged
  session get a dot, tapping one opens a simplified summary of what ran that
  day, and tapping that summary drills into the full edit sheet. Every day —
  logged or not — also has a *+ Log session* action that opens the log popup
  pre-filled with that date. Below the calendar: sessions logged (all types
  combined), average interval HR, days since your last session, a VO2max
  trend chart labeling each point with its exact value, a total-mileage bar
  chart filterable by week/month/year, and the full chronological session
  list (tap one to edit or delete it — *Add to Calendar* there downloads a
  standard `.ics` file for that session that Apple Calendar, Google
  Calendar, or Outlook can all import directly).
- **Log popup** — opened from the calendar, not its own tab. Record an
  **interval session** (Norwegian 4x4: intervals completed, per-set avg/peak
  HR and actual duration, recovery quality), an **easy run**, or a **long
  run** (duration, avg pace, distance, avg/max HR) — plus session RPE and
  notes, shared by all three. Each interval set's duration input defaults to
  the protocol's planned work time but is editable per set, for when an
  actual set ran long or short; the session's average HR is calculated live
  from whatever sets are filled in. For a run, key in avg pace and duration
  and distance fills in automatically (still editable by hand if you'd
  rather enter it directly). A VO2max reading isn't captured here — add one
  after the fact from the Dashboard if your watch reports it.
- **Zones** — both the LTHR-based and RHR-based (Karvonen) zone tables, the
  interval target zone highlighted, and a protocol quick-reference card.
- **Settings** — every number above (baseline VO2max, resting/max/threshold
  HR, which zone model is primary, and all of the protocol's
  reps/timing/frequency) is editable here — nothing is hardcoded once you've
  changed it. Export/import a JSON backup, or reset to defaults.

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
index.html                  markup and the two popup sheets (log session, edit session)
css/style.css               the whole dark theme
js/store.js                 localStorage CRUD for settings and sessions
js/zones.js                 zone tables, computed from settings
js/block.js                  progress stats — pure functions
js/chart.js                 dependency-free SVG charts: VO2max trend line, mileage bars
js/ics.js                   builds a per-session .ics file for calendar export
js/app.js                   rendering and events
sw.js                        offline cache
tools/gen-icons.mjs          draws the icons, no dependencies
../tests/vo2max-*.test.mjs   zone, progress-stats, chart and ics-export test suites
```
