# HYBR.D

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

Nav is Dashboard / Run / Workout / Settings — cardio (Run) and strength
(Workout) are tracked as separate, parallel domains throughout, with
Dashboard as the place they come together.

- **Dashboard** — a month calendar grid at the top (every day that has
  something logged shows a small icon: a run gets the running-figure glyph,
  a workout gets the dumbbell glyph, a day with both gets both), six stat
  tiles below it (runs logged, workouts logged, mileage this week, volume
  this week, days since your last run, days since your last workout) — plus
  Resting HR and Sleep tiles once intervals.icu sync is connected (see
  below) — and a combined **recent activity** feed — the last few runs and workouts,
  newest first, each tagged with a small running-figure or dumbbell icon
  and tappable straight into its edit sheet. Tapping a date on the calendar
  opens a popup listing that day's runs and workouts separately (tap one to
  edit or delete it), plus **+ Log run** and **+ Log workout** actions that
  open the respective log popup pre-filled with that date — this is the
  only place logging happens for a specific day; Run and Workout's own
  *+ Log* buttons always default to today.
- **Run** — the cardio detail view: sessions logged, average session HR,
  days since your last session, a VO2max trend chart labeling each point
  with its exact value, a total-mileage bar chart filterable by
  week/month/year, and the full chronological session list (tap one to edit
  or delete it — *Add to Calendar* there downloads a standard `.ics` file
  for that session that Apple Calendar, Google Calendar, or Outlook can all
  import directly). *+ Log run* opens the same popup as the Dashboard
  calendar's, defaulted to today: pick a **session type** — **interval**
  (Norwegian 4x4),
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
  (sets logged, filterable to week/month/year/all, rolled up into 9 general
  regions — Chest, Back, Shoulders, Arms, Quads, Hamstrings, Glutes, Abs,
  Core — since the exercise library's 22 body-part groups are too granular
  to plot as a readable chart; tap a region's label to expand it into the
  granular body parts behind it — e.g. Shoulders into Front/Lateral/Rear
  Delts — each shown as its share of that region's own sets, tap again or
  tap a different label to collapse or switch), a card per exercise you've
  ever logged (its
  muscle diagram and current PR — tap through to a detail sheet with best
  weight, estimated 1RM, times logged, and a weight-over-time progress
  chart), and the full workout history (tap one to edit or delete it).
  *+ Log workout* opens a popup: add exercises from a built-in 100+-exercise
  library (searchable, filterable by body part — 22 groups: Upper/Mid/Lower
  Chest, Front/Lateral/Rear Delts, Traps, Lats, Mid/Lower Back, Biceps,
  Triceps, Forearms, Abs, Core, Side Abs, Quads, Abductors, Adductors,
  Hamstrings, Glutes, Calves), each showing a front/back muscle diagram with
  its worked muscles highlighted in red (several granular groups share one
  region's artwork, e.g. all three chest groups highlight the same chest
  overlay), plus a "last time" hint recalled from your most recent session
  with that exercise. Log any number of weight × reps sets per exercise.
  *+ Create new exercise*, inside the same popup, adds your own: a name, an
  equipment type (Barbell/Dumbbell/Kettlebell/Cable/Machine/Bodyweight/Band),
  and any number of body parts it works — it's then searchable and loggable
  right alongside the built-in library, and deletable from its detail sheet
  (deleting it only removes the exercise definition; workouts that already
  used it keep their logged sets).
- **Settings** — every number above (baseline VO2max, resting/max/threshold
  HR, which zone model is primary, and all of the protocol's
  reps/timing/frequency) is editable here — nothing is hardcoded once you've
  changed it. Export/import a JSON backup (workouts included), or reset to
  defaults. A **Google Calendar sync** section (see below) automatically
  pushes every run and workout to its own dedicated calendar once connected,
  and an **intervals.icu sync** section automatically imports your runs
  (e.g. synced there from a Zepp-paired watch) — see below for both.
  Below that, an expandable **Zones & protocol reference**
  section: both the LTHR-based and RHR-based (Karvonen) zone tables, the
  interval target zone highlighted, and a protocol quick-reference card —
  collapsed by default so it doesn't compete with the settings form for
  attention.

## Google Calendar sync

Every run and workout you save is automatically pushed to a dedicated
**"HYBR.D Workouts"** calendar in your Google account (created for you on
first connect), and kept up to date — editing or deleting a session/workout
updates or removes its calendar event too. This is a static site with no
backend, so it talks to the Calendar API directly from your browser using
Google's own sign-in (Google Identity Services) — which means the app can
only ever see or edit the one calendar it created for itself, never your
existing calendars or events.

Because there's no backend, Google requires *you* to register the app with
your own free Google Cloud project before it can connect (a one-time, ~5
minute setup):

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a project (or reuse one you already have).
2. **APIs & Services → Library** — search for **Google Calendar API** and
   enable it.
3. **APIs & Services → OAuth consent screen** — choose **External**, fill in
   an app name (e.g. "HYBR.D Workouts"), your email as both support and
   developer contact. Leave the app in **Testing** status and add your own
   Google account under **Test users** — no verification/review needed for
   personal use.
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   — Application type **Web application**. Under **Authorized JavaScript
   origins**, add the origin the app is served from, e.g.
   `https://<username>.github.io` (no path, no trailing slash) — and
   `http://localhost:8000` too if you also run it locally. Save, then copy
   the generated Client ID (`xxxxxxxxxx.apps.googleusercontent.com`).
5. In the app: **Settings → Google Calendar sync**, paste that Client ID,
   tap **Connect**, and approve access (you'll see an "unverified app"
   warning since the app is only registered for your own testing use — that's
   expected; choose **Advanced → Go to (app name)** to proceed). Your
   existing run/workout history syncs automatically right after connecting.

Since browsers don't let a static site hold onto Google's access token
indefinitely, a fresh page load may occasionally need you to tap **Connect**
again before syncing resumes — **Sync all now** in Settings re-syncs
anything that was saved while disconnected. Disconnecting stops future
syncing but leaves everything already pushed to your calendar untouched.

## intervals.icu sync (for Zepp watches)

There's no public API for pulling data directly out of the Zepp app, and
(as of mid-2026) Strava now charges developers a monthly subscription just
to use its API — not worth it for a personal app. The workaround:
[intervals.icu](https://intervals.icu) is a free training-analysis platform
with its own direct Amazfit/Zepp integration — you sign into your Zepp
account right on intervals.icu, no Strava involved at all, and it syncs
automatically via webhook (faster than a Strava relay would be, and it
picks up wellness data like sleep and HRV too, not just workouts).

**Zepp account, connected directly on intervals.icu** (intervals.icu →
Settings → Amazfit → sign in with Zepp) **→ this app reading intervals.icu**
with your own free personal API key.

Every new **run** synced this way gets imported automatically, checked
each time the app is opened, complete with distance/duration/pace/HR - and
**VO2max**, too, when your watch estimated one that day: intervals.icu's
daily wellness log carries a VO2max reading alongside resting HR and
sleep, and an imported run's VO2max reading field is auto-filled from it
instead of being left for you to type in by hand. Lifts aren't covered —
intervals.icu has no equivalent to this app's per-exercise, per-set
strength data, so workouts still need to be logged by hand regardless.

Unlike Strava or Google, intervals.icu needs no OAuth flow and no
backend — just a personal API key you generate yourself, so setup is a
couple of minutes:

1. Create a free account at [intervals.icu](https://intervals.icu) if you
   don't have one, then connect your Zepp account directly: **Settings →
   Amazfit** → sign in with your Zepp login → tick the activity types you
   want synced (Runs, at least).
2. On the same Settings page, under **Developer Settings**, generate an
   **API Key** (and note your **Athlete ID**, shown just above it, e.g.
   `i123456`).
3. In the app: **Settings → intervals.icu sync**, paste both the Athlete ID
   and API Key, then tap **Connect**. Your run history from the last 90
   days imports right away; every app open after that checks for anything
   new since the last sync. **Sync now** re-checks on demand.

Disconnecting stops future imports but leaves already-imported runs in
your history untouched.

**No duplicates, and manual entries are never overwritten.** A date you've
already logged a run for by hand is skipped entirely by auto-sync - it
never gets touched, replaced, or deleted, even if intervals.icu also has an
activity for that same day. Going the other way, if you manually log a run
on a date that already has an auto-synced entry, the app asks first
("A run from intervals.icu was already auto-synced for ... Log this one
too?") so a genuine second run (e.g. a two-a-day) is still easy to add, but
you never end up with a surprise duplicate.

Connecting also adds **Resting HR** and **Sleep** tiles to the Dashboard,
reading intervals.icu's daily wellness log (looking back up to a week for
whichever value most recently showed up, since a watch doesn't always sync
same-day) - refreshed automatically on every app open alongside the run
sync, no separate action needed. Tiles only appear once there's actually a
value to show; nothing changes on the Dashboard before that. Tap either
tile to open a detail view: **Resting HR** as a line chart over Week/
Month/Year/All, **Sleep** as a bar chart of nightly duration over Week/
Month.

**Per-run detail.** Open any auto-synced run from Run history and tap
**View HR zones & graphs** to pull that specific activity's raw HR/pace
trace from intervals.icu: a bar chart of time spent in each HR zone (using
this app's own zone table from Settings, not intervals.icu's), a heart
rate line graph over the run's elapsed time, and a pace line graph over the
same. Manually-logged runs don't have this button - there's no raw stream
data behind them to chart.

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
js/store.js                 localStorage CRUD for settings, sessions, workouts and custom exercises
js/zones.js                 zone tables, computed from settings
js/block.js                 cardio progress stats — pure functions
js/workout.js                strength progress stats — PRs, last-performance, volume; pure functions
js/exercises.js              the built-in exercise library (name, equipment, muscles) and the radar chart's muscle-group rollup
js/muscleDiagram.js          stacks the muscle-diagram image assets for an exercise's muscles
js/icons.js                  the running-figure / dumbbell pictograms (calendar, recent activity)
js/chart.js                 dependency-free SVG charts: VO2max trend, mileage bars, exercise progress
js/ics.js                   builds a per-session .ics file for calendar export, and the shared
                              summary/description text + event resources used by gcal.js
js/gcal.js                  Google Identity Services auth + Calendar API calls for automatic sync
js/intervals.js              intervals.icu API-key auth + activity fetch/mapping for run import
                              (no backend needed - see the README's intervals.icu sync section)
js/app.js                   rendering and events
sw.js                        offline cache
tools/icon-source.png        the orange wordmark logo the app icons are built from
tools/gen-icons.py           crops/centers it into the icon set (needs Pillow, numpy)
tools/muscle-chart-source.jpg the anatomy illustration the muscle diagrams are built from
tools/gen-muscle-diagram.py  recolors it lighter grey and cuts an orange highlight overlay per
                              muscle group (needs Pillow, numpy, scipy) -> icons/muscles/
../tests/vo2max-*.test.mjs   zone, progress-stats, workout, exercise, muscle-diagram, icons, chart and ics-export test suites
```
