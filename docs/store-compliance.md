# App store compliance inputs

Prepared answers for the Apple privacy "nutrition label" and the Google Play
Data Safety form, plus the permission strings that must ship in the native
wrapper. Everything here is derived from the code, not aspirational — if a
behaviour changes, this file and `/legal/privacy` both have to change with it.

## Where the answers come from

| Behaviour | Code |
| --- | --- |
| Extraction (text + screenshots → Anthropic) | `src/app/api/extract/route.ts`, `src/lib/extract/llm.ts` |
| Link metadata scraping (Instagram / TikTok / YouTube) | `src/lib/extract/url.ts`, `src/lib/extract/og.ts` |
| Suggestions (Google Places, Anthropic web search) | `src/lib/advisor/places.ts`, `src/lib/advisor/search.ts` |
| Google Maps embeds loaded by the browser | `src/components/trip-map.tsx`, `src/components/item-editor.tsx` |
| Local storage of all trip data | `src/lib/store/state.ts` |
| Affiliate links | `src/lib/partners/index.ts` |
| Trip purpose, legs and cover (local only) | `src/lib/trip-purpose.ts`, `src/lib/rules/shared.ts` |
| Passport country and expiry, per traveller (local only) | `src/components/traveler-quick-add.tsx`, `src/lib/rules/compliance.ts` |
| Home-country guess from locale/timezone (no network, no location) | `src/lib/reference/home-country.ts` |
| Divert from group: who broke off, the chosen spot and when (local only, drawn as an inline map, no location read, no network) | `src/lib/divert/`, `src/components/divert/`, `src/lib/store/state.ts` |

---

## Apple — App Privacy ("nutrition label")

Apple asks, per data type: is it **collected**, is it **linked to the user**,
is it used for **tracking**. "Collected" means transmitted off device *and
retained*. Manifest retains nothing, so almost everything is "Not Collected".

| Data type | Collected? | Answer and reasoning |
| --- | --- | --- |
| Contact info (name, email, phone) | **No** | No account, no sign-in, no email capture. Traveller names are typed by the user and never leave the device. |
| Health & fitness | **No** | Vaccination *requirements* are reference data about a country, not a record about the user. |
| Financial info | **No** | Prices and budgets are stored on device only. No payment is ever taken. |
| Location | **No** | Location permission is never requested. Maps centre on filed places, not on the device. Divert from group works out where the group is from the trip's own timeline and a simulated or real clock, never from the device. The "flying from" default is inferred from the browser's own locale and IANA timezone (`Intl.DateTimeFormat().resolvedOptions()`) — a setting already on the device, not a geolocation lookup, and it never leaves it. Worth stating in review notes, since "guesses your country" invites the question. |
| Sensitive info | **No** | Passport country and expiry are captured during trip creation and stored on device only. They are read by the compliance rules, which run entirely locally against bundled reference data, and are never transmitted. |
| Contacts | **No** | The address book is never read. |
| User content (photos, other) | **No — but disclose in review notes** | A screenshot is *transmitted* for extraction and immediately discarded; it is not retained, so it is not "collected" under Apple's definition. Say so explicitly in the review notes to avoid a rejection for under-disclosure. |
| Browsing history | **No** | Not collected. |
| Search history | **No** | Discover queries are sent to Google Places / a search provider but not retained by us. |
| Identifiers (user ID, device ID) | **No** | None generated, none read. |
| Usage data | **No** | No analytics SDK ships. |
| Diagnostics | **No** | No crash reporter ships. |

**Tracking (ATT): No.** Nothing is linked to an identity or shared with a data
broker. Do **not** add `NSUserTrackingUsageDescription`.

> If privacy-preserving analytics are ever added, "Usage Data → Collected, not
> linked, not used for tracking" becomes the answer, and the privacy policy's
> Analytics section must be updated first.

### Review notes to paste into App Store Connect

> Manifest stores all trip data locally on device. There is no account and no
> user database. Two features transmit data, both user-initiated: (1) tapping
> Extract sends the pasted text or captured screenshot to our server, which
> forwards it to the Anthropic API for parsing — the content is processed in
> memory and never retained by us; (2) tapping Find in Discover sends a
> destination name and interest keywords to the Google Places API and to
> Anthropic's web search. Maps are Google Maps embeds loaded by the browser.
> No location permission is requested. To test, use the "Load the sample trip"
> option on first launch — no credentials are needed.

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
| Photos | Yes | Yes (Anthropic) | **Yes — processed in memory, not retained** | Optional | App functionality: reading a booking out of a screenshot |
| Other user-generated content (pasted text) | Yes | Yes (Anthropic) | **Yes** | Optional | App functionality: extracting booking details |
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
<string>Manifest uses the camera so you can photograph a booking confirmation and have its dates, prices and reference filed automatically. Photos are used for that one read and are not saved or uploaded.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>Manifest reads a screenshot you choose so it can pull the booking details out of it. Only the image you pick is read, and it is not saved or uploaded.</string>

<key>NSUserNotificationsUsageDescription</key>
<string>Manifest reminds you to check in for a flight, to pack the night before you leave, and about anything still unresolved as your trip approaches.</string>
```

Do **not** include `NSLocationWhenInUseUsageDescription` — location is never
requested, and declaring it invites a rejection asking why.

Calendar: Manifest exports an `.ics` file rather than writing to the calendar
directly, so **no calendar permission is needed**. If direct calendar writing is
ever added, it needs `NSCalendarsWriteOnlyAccessUsageDescription`.

### Android — rationale text

Shown before the system dialog, per Play's guidance.

- **Camera** — "To photograph a booking confirmation, Manifest needs access to your camera. The photo is read once to pull out the details and is not stored."
- **Photos / media** — "To read a screenshot of a booking, Manifest needs access to the image you select. Nothing else in your gallery is read."
- **Notifications** — "So Manifest can remind you about check-in, packing, and anything still unresolved before you fly. You can turn these off at any time."

Manifest requires no `ACCESS_FINE_LOCATION`, no `READ_CONTACTS`, and no
`READ_CALENDAR`.

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

- [ ] Replace `privacy@manifest.trip` and `support@manifest.trip` with monitored addresses — both stores verify them.
- [ ] Host the privacy policy at a public URL that does not require the app (the `/legal/privacy` route already qualifies once deployed).
- [ ] Set `NEXT_PUBLIC_SITE_URL` so the OpenGraph image and metadata resolve absolutely.
- [ ] Confirm the affiliate disclosure is visible before any paid link — required by the FTC, and by both stores' advertising policies.
- [ ] Re-read `/legal/privacy` against the code after any change to extraction, Discover, or maps.
- [ ] Icons: run `npm run icons:native` and confirm `ios-marketing-1024.png` reports `alpha: false` — the upload check rejects an alpha channel outright. See `docs/native-packaging.md`.
- [ ] Decide the iOS hybrid-vs-offline question in `docs/native-packaging.md`; it changes which Play data types are declared, because a fully-offline build transmits nothing at all.
