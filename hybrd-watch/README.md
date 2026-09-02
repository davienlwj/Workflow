# HYBR.D — Amazfit T-Rex 3 Pro companion app

A [Zepp OS](https://docs.zepp.com) mini-app for the **Amazfit T-Rex 3 Pro
(44mm)** that puts [HYBR.D](../vo2max/) — the training tracker this repo also
hosts — on your wrist: your latest VO2max reading, resting HR, sleep, days
since your last run, your HR zone table, and now a full strength-workout
logger that syncs what you lift straight into the phone app's history.

This is a separate project from the two Home Screen web apps at the repo
root and in `vo2max/` — a Zepp OS mini-app is a different kind of software
entirely (it runs on the watch's own OS, built and installed with Zepp's own
tooling), not a web page.

## What it shows

- **Today** — VO2max (and how it compares to your baseline), resting HR,
  sleep, days since your last run, and this week's running distance. All of
  it comes from [intervals.icu](https://intervals.icu) — the same
  no-backend, personal-API-key bridge the phone app's "intervals.icu sync"
  already uses, since there's no public API for reading data out of the Zepp
  app directly (see `../vo2max/README.md`).
- **HR Zones** — your full zone table (LTHR-based or resting-HR/Karvonen,
  whichever is set as primary), with the interval target zone picked out in
  orange. Computed on-device from your settings, no network needed.
- **Workout** — log a strength workout right from the gym floor: pick
  exercises from the full built-in library (grouped by body part, scrollable),
  key in weight/reps per set with a +/− stepper, reorder or superset
  exercises, and watch a live timer and running volume total while you go.
  Finishing shows a quick summary (time, volume, exercises, sets) and syncs
  the workout to the phone app's history via a GitHub Gist — see "Workout
  sync" below. **Runs stay on Zepp's own built-in workout tracking**, which
  already syncs to intervals.icu and from there into the phone app; this
  page is for strength training only, which intervals.icu has no equivalent
  for.

Only the built-in exercise library is loggable from the watch (not any custom
exercises you've added on the phone), and each set only records weight, reps
and a fixed "normal" set type — no warm-up/drop/failure marking, no machine
brand, no per-set notes. Everything the phone app's fuller editor supports is
still there once a workout arrives in your history; the watch is a fast
logger, not a replacement for it.

## Setup

### 1. Get an intervals.icu Athlete ID and API Key

If you've already connected intervals.icu sync in the phone app, you have
these already — reuse the same ones. Otherwise, follow
`../vo2max/README.md`'s "intervals.icu sync" section (create a free
intervals.icu account, connect your Zepp/Amazfit account under **Settings →
Amazfit**, then generate a personal **API Key** under **Developer
Settings**).

### 2. Set up workout sync (a GitHub Gist)

The watch's side-service and the phone app's browser storage are two
sandboxes with no way to reach each other directly, so a logged workout gets
to the phone via a private GitHub Gist you own - same "personal token, no
backend" shape as step 1, just using GitHub instead of intervals.icu:

1. At [gist.github.com](https://gist.github.com), create a new **secret**
   gist with one file named `hybrd-workouts.json` containing `{"workouts":[]}`.
   Save it, then copy its **Gist ID** from the URL
   (`gist.github.com/<username>/`**`<gist id>`**).
2. At **github.com → Settings → Developer settings → Personal access
   tokens**, generate a token with the **gist** scope (a classic token is
   simplest - fine-grained tokens don't currently cover gists). Copy it -
   GitHub only shows it once.

You'll paste both values into the watch's settings (step 3 below) and into
the phone app's own Settings → **Watch workout sync** section, so it can read
the same gist.

A secret gist isn't private/encrypted, just unlisted - anyone with the
direct URL (or the raw file URL) can read it. Fine for what's in here (just
your own lift numbers), but worth knowing.

### 3. Install the Zeus CLI and build this app

```sh
npm install -g @zeppos/zeus-cli
cd hybrd-watch
npm install
zeus login          # opens a browser to sign in with your Zepp developer account
zeus dev            # or: zeus preview — scan the printed QR code with the Zepp app to sideload
```

`zeus login`/`zeus create` normally allocates a real, unique `appId` for you;
`app.json` here ships with the placeholder `1000000` from Zepp's own docs,
which is fine for sideloading to your own watch but must be replaced with a
real one before any App Store submission.

### 4. Configure it on your phone

After sideloading, open the **Zepp app → Profile → My Watch → (this app's
settings icon)** and fill in:

- **intervals.icu sync** — Athlete ID and API Key from step 1.
- **Zones & baseline** — resting HR, max HR, LTHR, baseline VO2max/date, and
  a toggle for which zone model is primary. Match whatever's set in the phone
  app's own Settings screen so the two agree; the watch app ships with the
  same defaults the phone app does, so if you haven't touched either yet
  they're already in sync.
- **Workout sync (GitHub Gist)** — the Gist ID and personal access token
  from step 2.

Then in the phone HYBR.D app itself, open **Settings → Watch workout sync**
and paste the *same* Gist ID and token, then tap **Connect** — this is what
lets it actually pick up what the watch pushes there.

The watch re-fetches from intervals.icu each time the **Today** page opens
(and refetches the zone table each time **HR Zones** opens), same as the
phone app refreshing on every open — no background sync or manual refresh
button needed. Workout sync works the other direction: the watch pushes to
the Gist right after you finish logging a workout, and the phone app pulls
from it on every open (or **Sync now** in its Settings) — not instant, but
no more than an app-open away on either side.

### Workout sync details, and its one real limitation

Every time you tap **Finish** on the watch, it saves the workout locally
first (always succeeds), *then* tries to push your full local workout
history to the Gist in the background - so a slow or dropped connection to
GitHub right at that moment doesn't lose anything; the next successful sync
re-pushes the complete list anyway.

The one real gap: saving a finished workout **from the watch to the
phone/Zepp app itself** happens over Bluetooth, and needs that connection to
be up *at the moment you tap Finish*. If the watch is out of Bluetooth range
of your phone right then, the workout is lost - there's no on-watch-only
fallback storage for that case. Stay near your phone (or reconnect before
finishing) if you can; this is a known limitation, not a bug you need to
report.

## Layout

```
app.json                    manifest — targets round, 466px-wide watches (the T-Rex 3 Pro 44mm's bucket; Zepp OS's build tooling resolves the exact device from this shape/width, not a per-model ID)
app.js                      device-app entry point; owns globalData.liveWorkout, the in-progress workout
app-side/index.js           side service: handles GET_STATUS / GET_ZONES / SAVE_WORKOUT / GET_WORKOUTS
app-side/intervals.js       trimmed port of ../vo2max/js/intervals.js's intervals.icu client
app-side/gist.js            pushes the local workout history to the configured GitHub Gist
setting/index.js            phone-side settings page (intervals.icu, HR/baseline fields, zone model, Gist ID/token)
utils/zones.js              zone-table math, ported from ../vo2max/js/zones.js — keep the two in sync by hand
utils/constants.js          shared defaults (mirrors vo2max/js/store.js's DEFAULT_SETTINGS) and colors
utils/exercises.js          the built-in exercise library, generated from ../vo2max/js/exercises.js - id/name/group only, group precomputed from that file's RADAR_GROUP_FOR rollup; regenerate rather than hand-edit if the source library changes
utils/liveWorkout.js        the in-progress workout: add/reorder/remove exercises, add sets, supersets, timer/volume math - all operating on app.js's globalData
page/home/                  "Today" page: VO2max, resting HR, sleep, run status
page/zones/                 "HR Zones" page: the full zone table
page/workout/               workout hub: idle shows recent history + "New Workout"; in progress shows the live timer, running volume, and the exercise list
page/workout/groups/        muscle-group list (10 groups, scrollable) - the first step of adding an exercise
page/workout/exercises/     exercise list filtered to the chosen group (scrollable)
page/workout/sets/          weight/reps stepper for one exercise - "Add Set" repeatedly, then "Done"
page/workout/manage/        per-exercise controls: add more sets, move up/down, superset with next, remove
page/workout/summary/       shown after Finish: duration, volume, exercise and set counts
assets/t-rex-3-pro.r/       app icon (the ".r" suffix is Zepp's round-screen asset-group convention, not a typo)
```

## Why a separate Zepp OS project instead of extending the PWA

The two other apps in this repo are installable web pages (PWAs) that run in
a phone browser. A physical watch app is a fundamentally different runtime —
Zepp OS's own JS engine, UI widget system, and phone↔watch messaging model —
so it can't be "added" to `vo2max/`'s existing JS. What it *can* share is the
zone math and the intervals.icu integration's shape, both ported here rather
than duplicated from scratch.
