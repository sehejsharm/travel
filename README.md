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
npm test           # rules engine, extractor, checklists, calendar, share
npm run typecheck
```

Set `ANTHROPIC_API_KEY` to enable model-backed extraction. Without it the app
still works — the pattern pass handles structured content on its own, and
low-confidence content is filed with the reason shown rather than guessed at.

## Architecture

The trip lives on the device, in `localStorage`, behind a small store
(`src/lib/store/`). Nothing is uploaded, there is no account, and the app keeps
working with no signal — which matters on a plane and in a foreign country.

That leaves exactly one server route: `POST /api/extract`, which is stateless
and exists only to keep the API key off the client. Every page is prerendered
static. There is no database, no filesystem write, and nothing to provision, so
it deploys to any static-capable host.

It installs as a PWA — standalone display, generated icons, and a service
worker that caches the shell and content-hashed build assets while never
caching `/api`.

## The pipeline

| Screen | Route | What it does |
| --- | --- | --- |
| Trip | `/` | Countdown, what needs fixing, next up, budget, and the day-by-day timeline |
| Cabinet | `/cabinet` | Everything filed, filterable by places, activities, purchases, bookings |
| Add | `/add` | Paste content or a Reel/TikTok/YouTube link, watch it get extracted and grounded, file it |
| Checks | `/checks` | Every finding, plus the packing list and pre-trip tasks |
| More | `/more` | Calendar export, share link, recap, destination brief |
| Recap | `/recap` | Spend, places, and which platform each item actually came from |
| Shared | `/share#…` | Read-only trip, carried in the URL fragment so it never reaches a server |

### Extract and ground

`src/lib/extract/` runs cheapest-reliable-method-first:

1. **Link pass** (`url.ts`) — a pasted Reel, TikTok or YouTube link sets the
   source without the user picking it. Where the platform serves oEmbed without
   a token, the title is fetched and read too; where it does not, or the network
   is unavailable, the caption alone is used and the UI says so.
2. **Pattern pass** (`deterministic.ts`) — free and instant. Pulls prices,
   dates, flight numbers, airport codes, confirmation codes, traveller names and
   cancellation deadlines out of the text, then grounds any place name against
   the gazetteer to get coordinates.
3. **Model pass** (`llm.ts`) — only runs when the pattern pass scores below
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
  traveller name mismatches, no bed on the arrival night, overloaded days,
  venues booked on the day they are shut, venues that need booking ahead with no
  confirmation filed, and city changes with no transport booked for the hop.
- **Money** — budget rollup across currencies, planned vs booked, cancellation
  deadlines coming up, a stay running past the flight home, and the duty-free
  allowance waiting on the way back. Items with no price are counted separately,
  never treated as free.
- **Compliance** — visa and entry rules by passport and destination, passport
  validity against each country's requirement, insurance covering the trip,
  vaccination advice, and yellow fever proof where a route can trigger it.
- **Prep** — plug and voltage mismatches, the weather you are packing for,
  time zone shift, cash-heavy destinations, baggage allowance, roaming, and
  public holidays that fall inside the trip.

Countries you only change planes in are excluded from compliance and prep
checks — you do not clear immigration on a connection.

### Checklists

Pre-trip tasks are generated from the checks, so anything that needs doing
before departure becomes something you can tick off rather than a warning you
read once. The packing list is built from the trip: the seasonal weather where
you are going, the sockets there, how long you are away, and how much walking
you have filed. Both survive regeneration — a ticked box or an assignment is
never overwritten — and on a trip with more than one traveller, entries can be
assigned.

## Reference data

`src/lib/reference/` holds bundled datasets standing in for paid feeds. They are
deliberately behind interfaces so production can swap them out without callers
changing:

| Module | Stands in for | Swap for |
| --- | --- | --- |
| `entry-requirements.ts` | Visa and entry rules | Sherpa, Timatic |
| `health.ts` | Vaccination and health advisories | WHO, CDC, NaTHNaC |
| `places.ts` | Place name → coordinates, closing days | Google Places, Mapbox |
| `airports.ts` | Airport coordinates, connection times | OAG, airline feeds |
| `climate.ts` | Seasonal normals for packing | A forecast API, inside two weeks |
| `allowances.ts` | Baggage and duty-free limits | Airline and customs feeds |
| `holidays.ts` | Public holidays | Any holiday API |
| `fx.ts` | Currency conversion | Any live FX feed |
| `countries.ts` | Plugs, voltage, emergency numbers, tipping | — |

Entry requirements carry a `lastVerified` date and a source, and every flag
built on them tells the user to confirm with the embassy. Getting this wrong has
real consequences for a traveller, so the data is never presented as
authoritative.

## Known limits

- The gazetteer covers Japan; place names elsewhere file without coordinates and
  sit out the distance checks.
- FX rates and climate normals are static, and holidays are loaded for 2026.
- Instagram and TikTok gate oEmbed behind an app token, so a pasted link from
  either sets the source but cannot fetch a title — the caption carries the
  extraction. YouTube works without a key.
- Ingestion is paste-only. Real capture would come through the device share
  sheet — not by scraping the platforms, which would breach their terms.
- The trip is per-device. There is no account and no sync, so a second device
  starts fresh, and clearing browser data clears the trip.
- Collaboration is modelled but not authenticated: travellers can be assigned
  work and items record who filed them, but everyone on a device is everyone.
- A share link carries the trip inside it, so it is as private as the link. It
  strips prices, confirmation numbers and traveller names before encoding.
