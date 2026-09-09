# Manifest

Turns forwarded booking emails, screenshots and captions into a filed,
conflict-checked trip.

Most travel apps stop at organising what you typed in. The point of this one is
the layer underneath: it reads what you already have, files it, and then runs
the boring admin checks nobody does by hand — visa rules, passport validity,
refund deadlines, layovers that are too short, an activity booked somewhere you
cannot physically reach in time.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # rules engine and extractor
npm run typecheck
```

A SQLite database is created at `.data/manifest.db` on first run and seeded with
a sample trip, so every screen opens with something in it. Delete the directory
to start over.

Set `ANTHROPIC_API_KEY` to enable model-backed extraction. Without it the app
still works — the pattern pass handles structured content on its own, and
low-confidence content is filed with the reason shown rather than guessed at.

## The pipeline

Three screens, matching the three stages:

| Screen | Route | What it does |
| --- | --- | --- |
| Mailroom | `/mailroom` | Paste content, watch it get extracted and grounded, file it |
| Filing cabinet | `/cabinet` | Everything filed, sorted into places, activities, purchases, bookings |
| Planning desk | `/` | Timeline, budget, destination brief, and everything the checks caught |

### Extract and ground

`src/lib/extract/` runs cheapest-reliable-method-first:

1. **Pattern pass** (`deterministic.ts`) — free and instant. Pulls prices,
   dates, flight numbers, airport codes, confirmation codes, traveller names and
   cancellation deadlines out of the text, then grounds any place name against
   the gazetteer to get coordinates.
2. **Model pass** (`llm.ts`) — only runs when the pattern pass scores below
   `ESCALATION_THRESHOLD` (0.6). Returns null on any failure so the cheap result
   still stands.

A structured booking email scores ~0.95 and never reaches the model. A caption
like "this tiny standing sushi bar in tsukiji is unreal" scores 0.40 and does.

Grounding matters beyond tidiness: coordinates are what the feasibility checks
run on, which is why extraction captures location, price, currency and time
window rather than just a title.

### The checks

`src/lib/rules/` is pure functions over `(trip, items, now)`, so all of it is
unit tested without a database.

- **Conflicts** — overlapping bookings, gaps too short for the distance between
  two stops, layovers under the airport's published minimum connection time,
  traveller name mismatches, no bed on the arrival night, overloaded days.
- **Money** — budget rollup across currencies, planned vs booked, cancellation
  deadlines coming up. Items with no price are counted separately, never
  treated as free.
- **Compliance** — visa and entry rules by passport and destination, passport
  validity against each country's requirement, insurance covering the trip.
- **Prep** — plug and voltage mismatches, time zone shift, cash-heavy
  destinations.

Countries you only change planes in are excluded from compliance and prep
checks — you do not clear immigration on a connection.

## Reference data

`src/lib/reference/` holds bundled datasets standing in for paid feeds. They are
deliberately behind interfaces so production can swap them out without callers
changing:

| Module | Stands in for | Swap for |
| --- | --- | --- |
| `entry-requirements.ts` | Visa and entry rules | Sherpa, Timatic |
| `places.ts` | Place name → coordinates | Google Places, Mapbox |
| `airports.ts` | Airport coordinates, connection times | OAG, airline feeds |
| `fx.ts` | Currency conversion | Any live FX feed |
| `countries.ts` | Plugs, voltage, emergency numbers, tipping | — |

Entry requirements carry a `lastVerified` date and a source, and every flag
built on them tells the user to confirm with the embassy. Getting this wrong has
real consequences for a traveller, so the data is never presented as
authoritative.

## Known limits

- The gazetteer covers Japan; place names elsewhere file without coordinates and
  sit out the distance checks.
- FX rates are static.
- Ingestion is paste-only. Real capture would come through the device share
  sheet — not by scraping the platforms, which would breach their terms.
- Single trip, single device. There is no auth or multi-user support yet.
