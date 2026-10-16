# App store compliance inputs

Prepared answers for the Apple privacy "nutrition label" and the Google Play
Data Safety form, plus the permission strings that must ship in the native
wrapper. Everything here is derived from the code, not aspirational — if a
behaviour changes, this file and `/legal/privacy` both have to change with it.

## Where the answers come from

| Behaviour | Code |
| --- | --- |
| Extraction: pasted or shared text, or a screenshot downscaled on device, → our server (pattern pass, in memory) → Anthropic only with `ANTHROPIC_API_KEY` set (low-confidence text; every screenshot). With no key, screenshots are refused unread | `src/lib/capture.ts`, `src/app/api/extract/route.ts`, `src/lib/extract/` |
| Link metadata fetch (Instagram / TikTok / YouTube page, YouTube oEmbed), made by our server, not the device | `src/lib/extract/url.ts`, `src/lib/extract/og.ts` |
| Suggestions: the client sends destination, first destination country code, interests, every filed title and place name, and each filed place's name, city and notes → our server → Google Places (kind of place + destination only, where the destination may be the trip's name; needs `GOOGLE_PLACES_API_KEY`, and runs only when the Anthropic write step can use it) and Anthropic web search and write step (write step sees the filed names, cities and notes; needs `ANTHROPIC_API_KEY`) | `src/app/discover/page.tsx`, `src/app/api/advise/route.ts`, `src/lib/advisor/` |
| Abuse guard: same-origin and Sec-Fetch-Site checks, JSON only, and a per-IP request count over a rolling minute, held in memory only and lost when the server instance stops | `src/lib/api/guard.ts` |
| Share links: an allowlist of plan fields only — no traveller names, passports, insurance, visa help, budget, prices, confirmation numbers, refund deadlines, notes or who filed what; old links filtered again on open | `src/lib/share.ts` |
| Share target: text shared in from another app arrives in the `/add` URL. Once the service worker is installed it fetches and caches `/add` without the query, so the text stays on the device; on the very first launch it reaches the host in that page request | `src/app/manifest.ts`, `src/app/add/page.tsx`, `public/sw.js` |
| Preferences in localStorage (intro seen, sidebar folded, install prompt dismissed, review asked/declined); offline cache of pages and build assets | `src/components/onboarding.tsx`, `src/components/app-shell.tsx`, `src/components/install-prompt.tsx`, `src/lib/review.ts`, `public/sw.js` |
| The one contact address | `src/lib/contact.ts` (`NEXT_PUBLIC_CONTACT_EMAIL`) |
| Google Maps embeds loaded by the browser (cabinet map, item editor, a place typed in on Add) | `src/components/trip-map.tsx`, `src/components/item-fields.tsx` |
| Local storage of all trip data | `src/lib/store/state.ts` |
| Affiliate links | `src/lib/partners/index.ts` |
| Trip purpose, legs and cover (local only) | `src/lib/trip-purpose.ts`, `src/lib/rules/shared.ts` |
| Passport country and expiry, per traveller (local only) | `src/components/traveler-quick-add.tsx`, `src/lib/rules/compliance.ts` |
| Home-country guess from locale/timezone (no network, no location) | `src/lib/reference/home-country.ts` |
| Divert from group: who broke off, the chosen spot and when (local only, drawn as an inline map, no location read, no network) | `src/lib/divert/`, `src/components/divert/`, `src/lib/store/state.ts` |
| Unfinished work on Add — an item being typed in, text pasted or shared to be read (sessionStorage, this tab only, never in a backup, no network) | `src/lib/add-draft.ts`, `src/components/manual-add-trip-item.tsx`, `src/app/add/page.tsx` |

The answers below describe production as it runs today, with
`ANTHROPIC_API_KEY` unset, so nothing reaches Anthropic. **Before that key is
set, change two sets of answers:** Apple's Photos and Other User Content become
*Collected* (not linked to the user, not used for tracking, App
Functionality), and Play's Photos and user-generated content rows stop being
*ephemeral*. Anthropic keeps requests under its own retention policy, which
counts as retention by a partner under both stores' definitions. The privacy
policy already describes both cases.

---

## Apple — App Privacy ("nutrition label")

Apple asks, per data type: is it **collected**, is it **linked to the user**,
is it used for **tracking**. "Collected" means transmitted off device *and
retained*. Manifest retains nothing, so almost everything is "Not Collected".

| Data type | Collected? | Answer and reasoning |
| --- | --- | --- |
| Contact info (name, email, phone) | **No** | No account, no sign-in, no email capture. Traveller names typed into a trip stay on the device and are left out of share links. A booking email pasted to be read may contain names; that is user content, below — processed, not kept. |
| Health & fitness | **No** | Vaccination *requirements* are reference data about a country, not a record about the user. |
| Financial info | **No** | Prices and budgets are stored on device only and left out of share links. Pasted booking text may contain prices; it is processed, not kept. No payment is ever taken. |
| Location | **No** | Location permission is never requested. Maps centre on filed places, not on the device. Divert from group works out where the group is from the trip's own timeline and a simulated or real clock, never from the device. The "flying from" default is inferred from the browser's own locale and IANA timezone (`Intl.DateTimeFormat().resolvedOptions()`) — a setting already on the device, not a geolocation lookup, and it never leaves it. Worth stating in review notes, since "guesses your country" invites the question. |
| Sensitive info | **No** | Passport country and expiry are captured during trip creation and stored on device only. They are read by the compliance rules, which run entirely locally against bundled reference data, are never transmitted, and are left out of share links (`src/lib/share.ts`, with tests). |
| Contacts | **No** | The address book is never read. |
| User content (photos, other) | **No — but disclose in review notes** | A screenshot or pasted text is *transmitted* to be read and immediately discarded; Discover also transmits filed place names, cities and notes, and discards them. None of it is retained, so it is not "collected" under Apple's definition. Say so explicitly in the review notes to avoid a rejection for under-disclosure. |
| Browsing history | **No** | Not collected. |
| Search history | **No** | Discover's destination and interests reach our server and, where configured, Google Places and Anthropic's web search; not retained by us. |
| Identifiers (user ID, device ID) | **No** | None generated, none read, and no cookies set. The abuse guard counts requests per IP address over a rolling minute, in memory only, lost when the server instance stops. |
| Usage data | **No** | No analytics SDK ships. |
| Diagnostics | **No** | No crash reporter ships. |

**Tracking (ATT): No.** No cookies, no advertising identifier, nothing linked
to an identity or shared with a data broker. Do **not** add
`NSUserTrackingUsageDescription`.

> If privacy-preserving analytics are ever added, "Usage Data → Collected, not
> linked, not used for tracking" becomes the answer, and the privacy policy's
> "Cookies and tracking" section must be updated first.

### Review notes to paste into App Store Connect

> Manifest stores all trip data locally on device. There is no account, no
> user database and no cookies. Two features transmit data, both
> user-initiated, and our server keeps none of it: (1) tapping Extract sends
> the pasted text or chosen screenshot to our server, which reads it in memory
> and, when an AI model is enabled, forwards low-confidence text and
> screenshots to the Anthropic API; a pasted Instagram, TikTok or YouTube link
> is looked up by our server, not the device; (2) asking Discover for
> suggestions sends the destination, chosen interests, and the names, cities
> and notes of places already filed to our server, which may query the Google
> Places API (destination, which may be the trip's name, and kind of place only) and Anthropic's web search
> and API. Maps are Google Maps embeds loaded by the browser. Share links carry
> the itinerary only, with traveller names and documents removed. No location
> permission is requested. To test, use the "or look around a sample trip
> first" option on first launch — no credentials are needed.

---

## Google Play — Data Safety form

Play distinguishes **collected** (sent off device, for any duration) from
**shared** (passed to a third party). Manifest *does* transmit, so unlike
Apple's form, some rows are "Yes".

| Section | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **Yes** — see below. |
| Is all user data encrypted in transit? | **Yes** — HTTPS for every request. |
| Do you provide a way for users to request data deletion? | **Yes** — in-app deletion plus a documented route, at `/legal/data-deletion`. |
| Has your Data safety section been independently validated? | No |

### Data types to declare

| Type | Collected | Shared | Ephemeral? | Required? | Purpose |
| --- | --- | --- | --- | --- | --- |
| Photos | Yes | Yes (Anthropic, when enabled) | **Yes — processed in memory, not retained** | Optional | App functionality: reading a booking out of a screenshot |
| Other user-generated content (pasted or shared text; filed place names, cities and notes sent by Discover) | Yes | Yes (Anthropic, when enabled) | **Yes** | Optional | App functionality: extracting booking details; suggesting things to do |
| Other in-app search / activity (destination, interests) | Yes | Yes (Google, Anthropic) | **Yes** | Optional | App functionality: suggesting things to do |

Everything else — name, email, address, phone, location, financial info,
health, contacts, identifiers, crash logs, analytics — is **not collected and
not shared**.

Mark Photos and user-generated content as **ephemeral** ("processed but not
stored"). That is the accurate answer and materially changes how the listing
reads.

### Account deletion declaration

Play requires this even without accounts. Declare: *"This app does not support
account creation."* Supply `https://<domain>/legal/data-deletion` as the data
deletion URL.

---

## Permission strings

### iOS — `Info.plist`

These are shown verbatim in the system prompt. Apple rejects vague ones.

```xml
<key>NSCameraUsageDescription</key>
<string>Manifest uses the camera so you can photograph a booking confirmation and have its dates, prices and reference filed automatically. The photo is sent to Manifest's server for that one read and is not kept.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Manifest reads a screenshot you choose so it can pull the booking details out of it. Only the image you pick is sent to Manifest's server to be read, and it is not kept.</string>
```

No notification string: Manifest sends no notifications, so it asks for no
permission. If reminders are ever built, add `NSUserNotificationsUsageDescription`
then, and the privacy policy's permissions list with it.

Do **not** include `NSLocationWhenInUseUsageDescription` — location is never
requested, and declaring it invites a rejection asking why.

Calendar: Manifest exports an `.ics` file rather than writing to the calendar
directly, so **no calendar permission is needed**. If direct calendar writing is
ever added, it needs `NSCalendarsWriteOnlyAccessUsageDescription`.

### Android — rationale text

Shown before the system dialog, per Play's guidance.

- **Camera** — "To photograph a booking confirmation, Manifest needs access to your camera. The photo is sent to Manifest's server to be read once, and is not kept."
- **Photos / media** — "To read a screenshot of a booking, Manifest needs access to the image you select. Only that image is sent to be read; nothing else in your gallery is touched."

Manifest requires no `ACCESS_FINE_LOCATION`, no `READ_CONTACTS`, no
`READ_CALENDAR`, and no `POST_NOTIFICATIONS` (`twa-manifest.json` has
notifications off).

---

## Age rating

| Question | Answer |
| --- | --- |
| Apple age rating | **4+** |
| Play content rating (IARC) | **Everyone** |
| Violence, sexual content, profanity, gambling, drugs | None |
| User-generated content shared between users | **No** — a share link is a one-way snapshot the sender generates; there is no feed, no comments, no user-to-user messaging, and no moderation surface |
| Unrestricted web access | **Yes** — outbound links open Google Maps and merchant sites in the browser. Declare this; both stores treat an undeclared browser handoff as a rating problem. |
| In-app purchases | None |
| Advertising | None. Affiliate links are disclosed in-app and are not ad-network placements. |

---

## Before submission

- [ ] Set `NEXT_PUBLIC_CONTACT_EMAIL` to a monitored address and rebuild — it is the one address on every legal page, for deletion requests, and behind Help & feedback, and both stores verify it. Unset, it falls back to `support@manifest.trip`.
- [ ] Host the privacy policy at a public URL that does not require the app (the `/legal/privacy` route already qualifies once deployed).
- [ ] Set `NEXT_PUBLIC_SITE_URL` so the OpenGraph image and metadata resolve absolutely.
- [ ] Confirm the affiliate disclosure is visible before any paid link — required by the FTC, and by both stores' advertising policies.
- [ ] Re-read `/legal/privacy` against the code after any change to extraction, Discover, maps, share links, or what is kept in browser storage. The file lists its sources at the top.
- [ ] Icons: run `npm run icons:native` and confirm `ios-marketing-1024.png` reports `alpha: false` — the upload check rejects an alpha channel outright. See `docs/native-packaging.md`.
- [ ] Decide the iOS hybrid-vs-offline question in `docs/native-packaging.md`; it changes which Play data types are declared, because a fully-offline build transmits nothing at all.
