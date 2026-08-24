# HYBR.

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
  this week, days since your last run, days since your last workout), and a
  combined **recent activity** feed — the last few runs and workouts,
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
  and a **Strava sync** section automatically imports your runs from Strava
  (e.g. synced there from a Zepp-paired watch) — see below for both.
  Below that, an expandable **Zones & protocol reference**
  section: both the LTHR-based and RHR-based (Karvonen) zone tables, the
  interval target zone highlighted, and a protocol quick-reference card —
  collapsed by default so it doesn't compete with the settings form for
  attention.

## Google Calendar sync

Every run and workout you save is automatically pushed to a dedicated
**"HYBR. Workouts"** calendar in your Google account (created for you on
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
   an app name (e.g. "HYBR. Workouts"), your email as both support and
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

## Strava sync (for Zepp watches)

There's no public API for pulling data directly out of the Zepp app, but
Zepp *can* auto-push your workouts to Strava (Profile → Add accounts →
Strava, inside the Zepp app), and Strava has a real public API — so that's
the bridge this app uses: connect the same Strava account here, and every
new **run** on it gets imported automatically, checked each time the app is
opened. Lifts aren't covered — Strava's data model has no equivalent to
this app's per-exercise, per-set strength data, so workouts still need to
be logged by hand regardless.

Unlike Google, Strava's sign-in has no way to hand the browser a token
directly — the exchange requires a secret that can never be shipped to a
static site. So this one feature needs a tiny piece of backend: a
[Cloudflare Worker](https://workers.cloudflare.com/) (free tier is plenty)
that holds that secret and does nothing else. Setup is two parts, ~10
minutes total:

**Part 1 — Strava API app:**

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api) and
   create an API application. **Authorization Callback Domain** should be
   the domain the app is served from, e.g. `davienlwj.github.io` (no
   `https://`, no path).
2. Note the **Client ID** and **Client Secret** it gives you.

**Part 2 — deploy the proxy** (this repo's `vo2max/strava-proxy/` folder):

1. [Sign up for Cloudflare](https://dash.cloudflare.com/sign-up) (free) and
   install the CLI: `npm install -g wrangler`.
2. Edit `vo2max/strava-proxy/wrangler.toml`: set `STRAVA_CLIENT_ID` to the
   Client ID from Part 1, and `ALLOWED_ORIGIN` to your app's origin (e.g.
   `https://davienlwj.github.io`).
3. From `vo2max/strava-proxy/`, run `wrangler login`, then
   `wrangler secret put STRAVA_CLIENT_SECRET` and paste the Client Secret
   from Part 1 when prompted (this keeps it out of source entirely).
4. `wrangler deploy` — copy the `*.workers.dev` URL it prints out.

**Part 3 — connect from the app:**

In Settings → Strava sync, paste the Client ID and the Worker URL from
above, then tap **Connect** and approve access. Your run history from the
last 90 days imports automatically right after connecting; every app open
after that checks for anything new since the last sync.

Like Google Calendar sync, disconnecting stops future imports but leaves
already-imported runs in your history untouched.

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
js/strava.js                 Strava OAuth (via strava-proxy/) + activity fetch/mapping for run import
strava-proxy/                the one piece of backend this app needs - a Cloudflare Worker holding
                              Strava's OAuth client secret, deployed separately (see the README's
                              Strava sync section)
js/app.js                   rendering and events
sw.js                        offline cache
tools/icon-source.jpg        the hand-drawn mark the app icons are built from
tools/gen-icons.py           crops/centers it into the icon set (needs Pillow, numpy)
tools/muscle-chart-source.jpg the anatomy illustration the muscle diagrams are built from
tools/gen-muscle-diagram.py  recolors it lighter grey and cuts a red highlight overlay per
                              muscle group (needs Pillow, numpy, scipy) -> icons/muscles/
../tests/vo2max-*.test.mjs   zone, progress-stats, workout, exercise, muscle-diagram, icons, chart and ics-export test suites
```
