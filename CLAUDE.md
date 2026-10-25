@AGENTS.md

# Deployment

- Every push to `main` deploys to production at
  https://travel-kappa-steel-34.vercel.app (Vercel project `manifest19/travel`,
  production branch `main`). Anything broken on `main` goes live there at once.
- Work on a branch off `main` and open a pull request into `main`; never push
  to `main` directly. Each branch and pull request gets its own Vercel preview.
- https://travel-seven-ashen-29.vercel.app is an older project in another
  Vercel account. It no longer deploys from this repository, so it is not
  production: do not point people at it.
- On a fresh clone, run `npx next typegen` once before `npx tsc --noEmit`:
  Next.js writes the route types (`LayoutProps`, `PageProps`) into files git
  ignores. `npm run typecheck` does both.
