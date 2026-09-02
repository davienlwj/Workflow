# HYBR.D — Amazfit T-Rex 3 Pro companion app

A [Zepp OS](https://docs.zepp.com) mini-app for the **Amazfit T-Rex 3 Pro
(44mm)** that lets you log a strength workout right from the watch —
exercise, weight, reps, sets — and syncs it into [HYBR.D](../vo2max/)'s
history on your phone.

This is a separate project from the two Home Screen web apps at the repo
root and in `vo2max/` — a Zepp OS mini-app is a different kind of software
entirely (it runs on the watch's own OS, built and installed with Zepp's own
tooling), not a web page.

**Running stays on Zepp's own built-in workout tracking**, which already
syncs to intervals.icu and from there into the phone app (see
`../vo2max/README.md`'s "intervals.icu sync" section) — this app doesn't
duplicate that. It's for strength training, which has no such cloud bridge
to piggyback on.

## What it shows

- **Today** — a lift dashboard: days since your last watch-logged workout,
  that workout's name and exercise count, and total volume lifted this week.
  All from local workout history on the watch itself (there's no cloud
  source for lift data the way intervals.icu covers runs), so this only
  reflects workouts logged *from the watch* — one logged on the phone
  doesn't count here, sync only flows the other direction (watch → phone).
- **Workout** — log a strength workout: tapping "Workout" (or
  "+ Add Exercise" once one is in progress) goes straight to picking an
  exercise from the full built-in library (grouped by body part,
  scrollable — plus a "Custom" group for exercises you've added from the
  phone's Watch settings, see below), then a +/− weight/reps stepper per
  set. The stepper starts from what you actually lifted last time for that
  exercise — the most recent set within the current session if there is
  one, otherwise the last time you logged it in any past workout — rather
  than a generic default, so repeat sets (the common case) are often just
  "Add Set" with no adjustment at all. Reorder or superset exercises from
  the exercise-management screen, and watch a live timer and running volume
  total while you go. Finishing shows a quick summary (time, volume,
  exercises, sets) and syncs the workout to the phone app's history via a
  GitHub Gist — see "Workout sync" below.

A workout in progress survives quitting the app: it's saved to the watch's
own local storage on every change (not just on Finish), and restored when
you reopen HYBR.D, timer included — the elapsed time is computed from when
you started, not ticked while the app happens to be open, so it's correct
whether you were gone ten seconds or ten minutes.

Each set only records weight, reps and a fixed "normal" set type — no
warm-up/drop/failure marking, no machine brand, no per-set notes. Everything
the phone app's fuller editor supports is still there once a workout arrives
in your history; the watch is a fast logger, not a replacement for it.

### Deleting a workout

Tap any entry in the recent-history list on the idle Workout hub to open it,
then **Delete Workout**. This removes it from the watch immediately and
marks it for the phone to remove too on its next sync (or the reverse: if
you delete a synced workout on the phone first, the watch removes its own
copy the next time it syncs - see `../vo2max/README.md`'s "Watch workout
sync" section for how that direction works). Either way, deleting is
two-way - it doesn't matter which end you delete from.

### Custom exercises

Not in the built-in library? Add it from the watch itself: open **Custom**
at the end of the group list (Workout → + Add Exercise → Custom) and tap
**+ Create Exercise** - this brings up Zepp OS's own on-screen keyboard.
Or add it from the phone instead: Zepp app → this app's settings →
**Custom Exercises** → type a name (saved immediately - no separate button,
the field commits as you move away from it). Either way it syncs to the
other side and shows up in the watch's "Custom" group and the phone app's
own exercise library.

Kept deliberately simple: name only, no muscle group or equipment picker
either way. A workout that uses one still syncs to the phone app normally -
the sync also carries along the custom exercise's definition, so the phone
registers it in its own custom exercise list (as `Bodyweight`, no muscle
group) the first time such a workout comes in, rather than showing up
blank. Edit it further there anytime, same as one added by hand on the
phone.

## Setup

### 1. Set up workout sync (a GitHub Gist)

The watch's side-service and the phone app's browser storage are two
sandboxes with no way to reach each other directly, so a logged workout gets
to the phone via a private GitHub Gist you own - no backend, just a personal
credential you generate yourself:

1. At [gist.github.com](https://gist.github.com), create a new **secret**
   gist with one file named `hybrd-workouts.json` containing `{"workouts":[]}`.
   Save it, then copy its **Gist ID** from the URL
   (`gist.github.com/<username>/`**`<gist id>`**).
2. At **github.com → Settings → Developer settings → Personal access
   tokens**, generate a token with the **gist** scope (a classic token is
   simplest - fine-grained tokens don't currently cover gists). Copy it -
   GitHub only shows it once, and don't paste it anywhere but the two
   settings screens in step 3 below (not into a chat, an issue, anywhere
   else - treat it like a password).

You'll paste both values into the watch's settings (step 3 below) and into
the phone app's own Settings → **Watch workout sync** section, so it can read
the same gist.

A secret gist isn't private/encrypted, just unlisted - anyone with the
direct URL (or the raw file URL) can read it. Fine for what's in here (just
your own lift numbers), but worth knowing.

### 2. Install the Zeus CLI and build this app

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

### 3. Configure it on your phone

After sideloading, open the **Zepp app → Profile → My Watch → (this app's
settings icon)** and paste the Gist ID and personal access token from step 1
into **Workout sync (GitHub Gist)**.

Then in the phone HYBR.D app itself, open **Settings → Watch workout sync**
and paste the *same* Gist ID and token, then tap **Connect** — this is what
lets it actually pick up what the watch pushes there.

The watch pushes to the Gist right after you finish logging a workout, and
the phone app pulls from it on every open (or **Sync now** in its Settings)
— not instant, but no more than an app-open away on either side.

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
app-side/index.js           side service: GET_LIFT_STATUS / SAVE_WORKOUT / GET_WORKOUTS / DELETE_WORKOUT / GET_LAST_SET / GET_CUSTOM_EXERCISES / ADD_CUSTOM_EXERCISE / SYNC_NOW; syncWithGist() does the full two-way reconcile (pull deletions, apply them locally, push what's left) before every Gist write
app-side/gist.js            pushes the local workout history, custom exercises and the (echoed-through) deletedWorkoutIds to the Gist; also reads deletedWorkoutIds back so the watch can act on a deletion made from the phone
setting/index.js            phone-side settings page: Gist ID/token, and adding or removing custom exercises
utils/constants.js          shared defaults and colors
utils/exercises.js          the built-in exercise library, generated from ../vo2max/js/exercises.js - id/name/group only, group precomputed from that file's RADAR_GROUP_FOR rollup; regenerate rather than hand-edit if the source library changes
utils/liveWorkout.js        the in-progress workout: add/reorder/remove exercises, add sets, supersets, timer/volume math - operates on app.js's globalData, mirrored to a local file on every change so it survives quitting the app
page/home/                  "Today" page: days/last workout/weekly volume, from local workout history
page/workout/               workout hub: idle shows recent history + "Workout"; in progress shows the live timer, running volume, and the exercise list
page/workout/groups/        muscle-group list (10 groups, scrollable) - the first step of adding an exercise
page/workout/exercises/     exercise list filtered to the chosen group (scrollable)
page/workout/sets/          weight/reps stepper for one exercise - "Add Set" repeatedly, then "Done"
page/workout/manage/        per-exercise controls: add more sets, move up/down, superset with next, remove
page/workout/summary/       shown after Finish: duration, volume, exercise and set counts
page/workout/history/       tap a past workout from the hub's history list to open this - Delete Workout, or Back
assets/t-rex-3-pro.r/       app icon (the ".r" suffix is Zepp's round-screen asset-group convention, not a typo)
```

## Why a separate Zepp OS project instead of extending the PWA

The two other apps in this repo are installable web pages (PWAs) that run in
a phone browser. A physical watch app is a fundamentally different runtime —
Zepp OS's own JS engine, UI widget system, and phone↔watch messaging model —
so it can't be "added" to `vo2max/`'s existing JS. What it *can* share is the
exercise library's shape, generated here rather than duplicated by hand.
