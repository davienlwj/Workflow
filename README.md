# Workflow

A minimal calendar you add to your Home Screen. Type or dictate one line;
it works out the subject, date, time and place, shows you what it understood,
and files it.

> "meeting with Tom at KLCC at 3pm on 12/8"

| Subject | Date | Time | Location |
| --- | --- | --- | --- |
| Meeting with Tom | 12 Aug | 3:00pm | KLCC |

No account, no server, no tracking. Everything stays in the browser's local
storage on your device, and the app works offline once it has loaded.

## Put it on your Home Screen

The app has to be served over HTTPS (or `localhost`) for the offline support
and Home Screen install to work.

**iPhone / iPad** — open the URL in Safari, tap Share, then *Add to Home
Screen*. It launches full screen with no browser chrome.

**Android** — open in Chrome, tap the ⋮ menu, then *Add to Home screen*.

### Hosting it on GitHub Pages

`.github/workflows/pages.yml` runs the tests and publishes the site on every
push. Turn it on once: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The app then lives at `https://<username>.github.io/<repo>/`.

GitHub Pages only serves **public** repositories on the free plan. If the repo
is private, either make it public — nothing here is secret, and your tasks
never leave your phone — or deploy the same folder to Cloudflare Pages or
Netlify, which both serve private repos over HTTPS for free.

### Running it locally

Any static file server will do — the app uses ES modules, so opening
`index.html` from the file system will not work.

```sh
python3 -m http.server 8000   # then open http://localhost:8000
npm test                      # run the parser test suite
npm run icons                 # regenerate the app icons
```

## Dictation

Tap the microphone and talk. When you stop, the review sheet opens with the
fields already filled in.

The button appears only where the browser supports speech recognition
(Chrome, Edge, and Safari). If it is hidden, or if you prefer it, tap the text
box and use the microphone key on your keyboard instead — dictating into the
box works exactly the same way.

## What it understands

Everything is optional and order does not matter. Whatever is left after the
date, time and place have been picked out becomes the subject.

**Times** — `3pm`, `3.30pm`, `10:15am`, `14:00`, `at 3` (afternoon),
`at 9` (morning), `noon`, `midnight`, `tonight`, `in the morning`.
Meals settle the half of the day: `dinner at 8` is 8pm, `breakfast at 8` is 8am.

**Ranges and durations** — `3-5pm`, `from 9:30 to 11am`, `2pm for 2 hours`,
`3pm for 45 mins`.

**Dates** — `today`, `tomorrow`, `tmr`, `tonight`, `friday`, `next monday`,
`in 3 days`, `next week`, `12/8`, `25-12-2027`, `12 Aug`, `Aug 25`,
`3rd of September`, `2026-11-05`.

**Places** — anything after `at`, `in` or `@`: `at KLCC`, `in the office`,
`@ Ilham Tower`. It stops at a connector, so `at KLCC to discuss the budget`
keeps *KLCC* as the place and the rest as the subject. A time like `at 3pm` is
never mistaken for a place.

A few sensible defaults, all changeable in the review sheet before saving:

- `12/8` reads as **12 August**. Flip it to month-first in settings (`···`).
- A bare date more than a week in the past means next year: `5/1` typed in
  August is next January.
- No date in the text means the day you have selected on the calendar.

## Day, week, month, year

Under the calendar sit four buttons. They change how much the list below
shows, all anchored on the day you have selected:

| | Shows | Heading |
| --- | --- | --- |
| **Day** | that one day | `Today · Thu, 13 Aug` |
| **Week** | the week around it, highlighted on the grid | `Aug 10 – 16` |
| **Month** | the whole month | `August 2026` |
| **Year** | the whole year | `2026` |

Alongside the heading is the tally for that span — `12 tasks · 5 done`. Week,
month and year group what they list under a heading per day, so a month reads
as a run of days rather than one long column. The choice sticks between
launches.

## Using it

- **Tap a day** to see it; the dots under a date show how many tasks it holds.
- **Tap the month name** to jump back to today.
- **Swipe the grid** sideways, or use `‹` `›`, to change month.
- **Tap the circle** to tick a task off, **tap the task** to edit or delete it.
- **`···`** holds date order, 24-hour time, week start, and export/import of
  everything as a JSON file.

## Layout

```
index.html                 markup and the two sheets
css/style.css              the whole design: one accent, system font
js/parser.js               text in, {subject, date, time, location} out
js/ranges.js               day/week/month/year windows and their totals
js/store.js                localStorage CRUD and settings
js/app.js                  rendering and events
sw.js                      offline cache
tools/gen-icons.mjs        draws the icons, no dependencies
tests/                     parser and range test suites
```

The parser has no dependencies and does not talk to a network, so the app
keeps working on a plane and your tasks never leave the phone.
