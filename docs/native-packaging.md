# Native packaging

Manifest is a PWA first. These wrappers exist so the same build can be
submitted to the App Store and Play Store — not so it becomes a different app.

## What is here

| File | Purpose |
| --- | --- |
| `capacitor.config.ts` | iOS wrapper config |
| `twa-manifest.json` | Android Trusted Web Activity, for Bubblewrap |
| `scripts/build-native-icons.mjs` | Renders the native icon set from the app's own icon routes |
| `native/icons/` | The generated output, committed so submission needs no build |

## The two things the web icons could not do

**Alpha.** Everything `next/og` renders is RGBA, and the App Store rejects a
1024 marketing icon that carries an alpha channel — this is an automated
check at upload, so it blocks submission outright. The script flattens onto
the brand ink and calls `removeAlpha()`, which drops the channel rather than
merely setting it opaque, then asserts on the way out that nothing but the
adaptive foreground still has one.

**Adaptive icons.** Android's launcher icon is two layers, not one image, and
only the middle 72 of 108dp is guaranteed visible. The foreground is composed
at 432px with the mark scaled into that safe circle and transparent padding
around it — that layer keeps its alpha deliberately. The background is a flat
ink plate; Android parallaxes the two apart.

Regenerate with the app running:

```bash
npm run build && npm start          # the icon routes must be served
npm run icons:native                # writes native/icons/
```

## iOS, via Capacitor

```bash
npm i -D @capacitor/cli @capacitor/core @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios
```

Then in Xcode: set the team, bump the bundle id if `trip.manifest.app` is
taken, and drop `native/icons/ios-*.png` into the asset catalog.

**`server.url` is deliberately unset.** Pointing the shell at a hosted URL is
the fast way to ship and the fast way to be rejected under guideline 4.2,
which treats a wrapped website as not an app. Bundling the build means the app
opens with no network at all — which is also what Manifest claims about
itself, so this is the honest configuration as well as the compliant one.

That requires a static export. Add to `next.config.ts`:

```ts
output: "export"
```

…but note what that costs: `/api/extract` and `/api/advise` are server routes,
so a static export drops automatic extraction and Discover. **The native build
must point those two at the deployed web instance** via
`NEXT_PUBLIC_API_ORIGIN`, or ship without them. Everything else — filing,
checks, timeline, budget, backup, sharing — is local and unaffected.

This is the one place the local-only architecture and native packaging pull
against each other, and it needs a decision before submission:

1. **Hybrid** (recommended): bundle the app, call the hosted API for
   extraction and Discover. Those two already require a network anyway.
2. **Fully offline**: drop both features from the native build. Manifest still
   does the thing it is actually about — checking a plan — but loses the
   headline "screenshot it and it files itself".

## Android, via Bubblewrap

A TWA is the better fit here: it runs the real PWA, so there is no second
build to keep in sync, and Play does not apply guideline 4.2.

```bash
npm i -g @bubblewrap/cli
# Replace REPLACE_WITH_DEPLOYED_HOST in twa-manifest.json first.
bubblewrap init --manifest="https://<host>/manifest.webmanifest"
bubblewrap build
```

Digital Asset Links must be served at `/.well-known/assetlinks.json` with the
signing-key fingerprint from `bubblewrap build`, or the TWA opens with a
browser address bar instead of full screen. Add it as a route once the
fingerprint exists — it cannot be written before the key is generated.

## Still required before either store accepts a build

- [ ] Replace `privacy@manifest.trip` and `support@manifest.trip` with monitored addresses
- [ ] Decide hybrid vs fully-offline for iOS (above)
- [ ] Generate the signing key and publish `assetlinks.json` for Android
- [ ] Screenshots per device size — see `docs/store-listing.md`
