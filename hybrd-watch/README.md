# HYBR.D — Amazfit T-Rex 3 Pro companion app

A [Zepp OS](https://docs.zepp.com) mini-app for the **Amazfit T-Rex 3 Pro
(44mm)** that puts a slice of [HYBR.D](../vo2max/) — the VO2max tracker this
repo also hosts — on your wrist: your latest VO2max reading, resting HR,
sleep, days since your last run, and your HR zone table, without opening the
phone app.

This is a separate project from the two Home Screen web apps at the repo
root and in `vo2max/` — a Zepp OS mini-app is a different kind of software
entirely (it runs on the watch's own OS, built and installed with Zepp's own
tooling), not a web page.

## What it shows

- **Today** — VO2max (and how it compares to your baseline), resting HR,
  sleep, days since your last run, and this week's running distance.
- **HR Zones** — your full zone table (LTHR-based or resting-HR/Karvonen,
  whichever is set as primary), with the interval target zone picked out in
  orange.

**Strength training stays phone-only.** Everything above comes from
[intervals.icu](https://intervals.icu) — the same no-backend, personal-API-key
bridge the phone app's "intervals.icu sync" already uses, since there's no
public API for reading data out of the Zepp app directly (see
`../vo2max/README.md`). intervals.icu has no equivalent to this app's
per-exercise, per-set lift data, so workout logging and history stay on the
phone; this is a read-only, at-a-glance companion, not a second place to log
anything.

## Setup

### 1. Get an intervals.icu Athlete ID and API Key

If you've already connected intervals.icu sync in the phone app, you have
these already — reuse the same ones. Otherwise, follow
`../vo2max/README.md`'s "intervals.icu sync" section (create a free
intervals.icu account, connect your Zepp/Amazfit account under **Settings →
Amazfit**, then generate a personal **API Key** under **Developer
Settings**).

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
settings icon)** and fill in:

- **intervals.icu sync** — Athlete ID and API Key from step 1.
- **Zones & baseline** — resting HR, max HR, LTHR, baseline VO2max/date, and
  which zone model is primary. Match whatever's set in the phone app's own
  Settings screen so the two agree; the watch app ships with the same
  defaults the phone app does, so if you haven't touched either yet they're
  already in sync.

The watch re-fetches from intervals.icu each time the **Today** page opens
(and refetches the zone table each time **HR Zones** opens), same as the
phone app refreshing on every open — no background sync or manual refresh
button needed.

## Layout

```
app.json                    manifest — targets round, 466px-wide watches (the T-Rex 3 Pro 44mm's bucket; Zepp OS's build tooling resolves the exact device from this shape/width, not a per-model ID)
app.js                      device-app entry point
app-side/index.js           side service: handles GET_STATUS / GET_ZONES requests from the watch
app-side/intervals.js       trimmed port of ../vo2max/js/intervals.js's intervals.icu client
setting/index.js            phone-side settings page (Athlete ID, API Key, HR/baseline fields, zone model)
utils/zones.js              zone-table math, ported from ../vo2max/js/zones.js — keep the two in sync by hand
utils/constants.js          shared defaults (mirrors vo2max/js/store.js's DEFAULT_SETTINGS) and colors
page/home/                  "Today" page: VO2max, resting HR, sleep, run status
page/zones/                 "HR Zones" page: the full zone table
assets/t-rex-3-pro.r/       app icon (the ".r" suffix is Zepp's round-screen asset-group convention, not a typo)
```

## Why a separate Zepp OS project instead of extending the PWA

The two other apps in this repo are installable web pages (PWAs) that run in
a phone browser. A physical watch app is a fundamentally different runtime —
Zepp OS's own JS engine, UI widget system, and phone↔watch messaging model —
so it can't be "added" to `vo2max/`'s existing JS. What it *can* share is the
zone math and the intervals.icu integration's shape, both ported here rather
than duplicated from scratch.
