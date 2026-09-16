# Store listing copy

Written from what the app actually does, not from what a travel app usually
claims. Every differentiator below is a feature you can open and use today.

---

## Name and subtitle

**App name (Apple, 30 char max):** `Manifest: Trip Checker`
**Subtitle (Apple, 30 char max):** `Files bookings, finds problems`

**Title (Play, 30 char max):** `Manifest — Trip Planner`
**Short description (Play, 80 char max):**
`Your bookings, filed automatically — then checked for what ruins trips.`

Alternates, if the primary name is taken:
`Manifest Travel Filer` · `Manifest: Trip Manifest` · `Manifest Trip Desk`

---

## Promotional text (Apple, 170 char, editable without a release)

> Screenshot a confirmation and it files itself. Then Manifest checks the plan:
> layovers too short, a museum shut that day, a passport expiring mid-trip.

---

## Full description

> **Your trip, in one file. Checked.**
>
> Most trip planners are a place to type things in. Manifest is the opposite: you
> send it what you already have, and it does the typing.
>
> **Send it anything**
> A booking confirmation email. A screenshot of a hotel reservation. A Reel you
> saved of a restaurant. Paste it, photograph it, or share it straight from
> another app — Manifest pulls out the dates, the price, the confirmation number
> and the place, and files it. No forms.
>
> **Then it checks the plan**
> This is the part nothing else does. Manifest runs twenty-three checks over what
> you have filed and tells you what is wrong before it costs you:
>
> • A 45-minute layover at an airport that requires 90
> • A museum booked on the Monday it is closed
> • A passport that expires two weeks after you land, where three months are required
> • A hotel that checks out the day before your flight leaves
> • Two things booked at the same time on the same afternoon
> • A visa you need and have not applied for yet
> • Spend drifting past your budget, in one currency
>
> **Everything it needs, before you go**
> A packing list built from the actual weather where you are going, the sockets
> there, and what you have planned. Pre-trip tasks raised by the checks
> themselves — tick one off and the readiness ring moves. Currency, plug types,
> emergency numbers and the time difference, the moment you pick a destination.
>
> **Things to do, from sources you can see**
> Pick what you are into — eating, outdoors, art, nights out — and Manifest
> suggests places, working down from your own saved items to trips other people
> published before it spends anything on a search. Every suggestion names where
> it came from, and anything it cannot trace to a real source is thrown away.
>
> **Private by construction, not by promise**
> There is no account. There is no server holding your trip. Everything lives on
> your phone, which is why it works on a plane, in a queue at immigration, and
> anywhere with no signal — exactly when you need a booking reference most. You
> can export the lot to a file at any time, and delete all of it in two taps.
>
> Free. No subscription, no ads.

---

## Keywords (Apple, 100 char, comma-separated, no spaces)

```
trip,itinerary,travel,planner,booking,flight,visa,packing,checklist,layover,passport,offline,organiser
```

Deliberately omitted: the app name (indexed already), plural forms (Apple stems
them), and high-competition heads like "vacation" that this app cannot rank on.

**Play** has no keyword field — the terms above are worked into the short and
full descriptions instead, which is what Play indexes.

---

## Screenshots

Five, in this order. The order is the argument: the problem, the magic, the
differentiator, the payoff, the promise.

| # | Screen | Caption |
| --- | --- | --- |
| 1 | Checks screen, criticals visible | **It finds what you would have missed** — a layover too short, a museum shut that day |
| 2 | Add screen, mid-extraction with a screenshot | **Screenshot it. That is the whole workflow.** |
| 3 | Cabinet, filled, with the map view | **Every booking, filed and pinned** — without typing any of it |
| 4 | Trip screen hero, ring at ~80% | **One number for how ready you are** — and it moves as you tick things off |
| 5 | More → This device, offline | **No account. Nothing uploaded. Works with no signal.** |

**Sizes required**

- iPhone 6.9" — 1320 × 2868 (required)
- iPhone 6.5" — 1242 × 2688 (required if 6.9" is not supplied for all)
- iPad 13" — 2064 × 2752 (required only if the iPad build ships)
- Play phone — 1080 × 1920 minimum, 2:1 max ratio
- Play feature graphic — 1024 × 500 (required, no transparency)

Use the sample trip for every screenshot: it is populated, realistic, and
contains genuine conflicts to point at. Do not use a screenshot of an empty
state.

---

## App preview video (optional, 15–30s)

One unbroken take, no narration, captions only:

1. Paste a flight confirmation → tap Extract → fields appear (0–6s)
2. Tap File it → it lands in the cabinet (6–10s)
3. Cut to Checks → a critical conflict slides in (10–18s)
4. Tick the task → the ring moves (18–24s)
5. End card: the mark, "Everything about your trip, in one file." (24–28s)

---

## Landing page

Separate from the app. Above the fold:

- **Headline:** Everything about your trip, in one file.
- **Sub:** Send it a booking email or a screenshot. It files itself, then checks the plan for what ruins trips. Free, no account, works offline.
- **Primary action:** store badges, with "or use it in your browser" underneath — the PWA is a real product, not a demo.
- **Proof:** a looping 10-second capture of Add → filed → a conflict being flagged. The conflict is the hook; lead with it.

Below the fold, in order: the checks (with three real examples), the privacy
architecture (this is the trust argument, so give it room), then the offline
claim, then a link to the privacy policy. Do not put pricing above the fold —
there is nothing to price.

---

## Press kit

Ship at `/press` or as a zip:

- The mark: SVG, plus PNG at 512 and 1024 on transparent and on `#0b1116`
- The 1024 store tile (`/icons/store`)
- The OpenGraph card (`/opengraph-image`)
- Five device screenshots, framed and unframed
- Palette: `#0b1116` ink, `#c1793d` accent, `#f4f6f3` paper
- Typefaces: Fraunces (display), IBM Plex Sans, IBM Plex Mono

**One-paragraph description for press and review sites:**

> Manifest is a trip planner that works backwards from how people actually
> plan. Instead of asking you to fill in forms, it reads the confirmations,
> screenshots and links you already have and files them for you — then runs
> twenty-three checks over the result, flagging layovers too short to make,
> venues booked on days they are shut, passports expiring too close to the trip,
> and spend drifting past budget. It has no accounts and no server: every trip
> lives on the device, which means it keeps working with no signal, and there is
> no database of anyone's travel plans to breach or subpoena.

---

## Analytics, and why there is almost none

Store Connect and Play Console already report impressions, product page views,
conversion rate and installs per source, broken down by keyword and by
screenshot set through A/B testing. That covers store optimisation without
shipping a single line of tracking code, and it is the only analytics this app
should use while its pitch is privacy.

If in-app measurement is ever needed, the bar is: aggregate counts only, no
device or user identifier, no third-party SDK, and a self-hosted endpoint.
Anything else contradicts the listing above — and the privacy policy would have
to change first, not after.
