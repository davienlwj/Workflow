# HYBIRD

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
npm run muscle-diagram:vo2max       # regenerate the muscle-diagram image assets
```

## What's in it

Nav is Dashboard / Calendar / Run / Workout / Settings — cardio (Run) and
strength (Workout) are tracked as separate, parallel domains throughout,
with Dashboard and Calendar as the two places they come together.

- **Dashboard** — a pure summary, no logging here: six stat tiles (runs
  logged, workouts logged, mileage this week, volume this week, days since
  your last run, days since your last workout) and a combined
  **recent activity** feed — the last few runs and workouts, newest first,
  each tagged with a small running-figure or dumbbell icon and tappable
  straight into its edit sheet.
- **Calendar** — a month grid where every day that has something logged
  shows the same icons (a run gets the running-figure glyph, a workout gets
  the dumbbell glyph, a day with both gets both). Tapping a day opens a
  panel listing that day's runs and workouts separately (tap one to edit or
  delete it), plus **+ Log run** and **+ Log workout** actions that open the
  respective log popup pre-filled with that date — this is the only place
  logging happens for a specific day; Run and Workout's own *+ Log* buttons
  always default to today.
- **Run** — the cardio detail view: sessions logged, average session HR,
  days since your last session, a VO2max trend chart labeling each point
  with its exact value, a total-mileage bar chart filterable by
  week/month/year, and the full chronological session list (tap one to edit
  or delete it — *Add to Calendar* there downloads a standard `.ics` file
  for that session that Apple Calendar, Google Calendar, or Outlook can all
  import directly). *+ Log run* opens the same popup as Calendar's, defaulted
  to today: pick a **session type** — **interval** (Norwegian 4x4),
  **easy run**, or **long run** — then the same fields for all three:
  duration, avg pace, distance (fills in automatically once duration and
  pace are both entered), avg/max HR, session RPE and notes. A VO2max
  reading isn't captured on the log form — add one after the fact from the
  edit sheet if your watch reports it. Interval sessions logged before this
  shared field set (with a per-set avg/peak HR breakdown and recovery
  quality) still display and export to `.ics` correctly; editing one keeps
  that history intact even though the edit form itself no longer shows
  those fields.
- **Workout** — the strength detail view: workouts logged, this week's
  total volume, days since your last workout, a muscle-balance radar chart
  (sets logged per muscle group, filterable to week/month/year/all — a set
  counts toward every muscle its exercise targets, not just the primary
  one), a card per exercise you've ever logged (its muscle diagram and
  current PR — tap through to a detail sheet with best weight, estimated
  1RM, times logged, and a weight-over-time progress chart), and the full
  workout history (tap one to edit or delete it). *+ Log workout* opens a
  popup: add exercises from a built-in ~50-exercise library (searchable,
  filterable by muscle group), each showing a front/back muscle diagram
  with its worked muscles
  highlighted in red, plus a "last time" hint recalled from your most
  recent session with that exercise. Log any number of weight × reps sets
  per exercise.
- **Settings** — every number above (baseline VO2max, resting/max/threshold
  HR, which zone model is primary, and all of the protocol's
  reps/timing/frequency) is editable here — nothing is hardcoded once you've
  changed it. Export/import a JSON backup (workouts included), or reset to
  defaults. Below that, an expandable **Zones & protocol reference**
  section: both the LTHR-based and RHR-based (Karvonen) zone tables, the
  interval target zone highlighted, and a protocol quick-reference card —
  collapsed by default so it doesn't compete with the settings form for
  attention.

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
index.html                  markup and the four popup sheets (log/edit session, log/edit workout, exercise progress)
css/style.css               the whole light theme
js/store.js                 localStorage CRUD for settings, sessions and workouts
js/zones.js                 zone tables, computed from settings
js/block.js                 cardio progress stats — pure functions
js/workout.js                strength progress stats — PRs, last-performance, volume; pure functions
js/exercises.js              the built-in exercise library (name, equipment, muscles)
js/muscleDiagram.js          stacks the muscle-diagram image assets for an exercise's muscles
js/icons.js                  the running-figure / dumbbell pictograms (calendar, recent activity)
js/chart.js                 dependency-free SVG charts: VO2max trend, mileage bars, exercise progress
js/ics.js                   builds a per-session .ics file for calendar export
js/app.js                   rendering and events
sw.js                        offline cache
tools/icon-source.jpg        the hand-drawn mark the app icons are built from
tools/gen-icons.py           crops/centers it into the icon set (needs Pillow, numpy)
tools/muscle-chart-source.jpg the anatomy illustration the muscle diagrams are built from
tools/gen-muscle-diagram.py  recolors it lighter grey and cuts a red highlight overlay per
                              muscle group (needs Pillow, numpy, scipy) -> icons/muscles/
../tests/vo2max-*.test.mjs   zone, progress-stats, workout, exercise, muscle-diagram, icons, chart and ics-export test suites
```
