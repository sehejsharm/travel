/**
 * The origin absolute metadata URLs are built on — mostly the OpenGraph card
 * a shared link previews with.
 *
 * NEXT_PUBLIC_SITE_URL wins when it holds a real address, and a bare host is
 * read as https. Otherwise Vercel's own production domain is used, which it
 * sets on every deployment, and only then a placeholder. A variable that
 * exists but is blank — which is what copying .env.example into a host's
 * settings leaves behind — counts as unset rather than failing the build.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  for (const [name, raw] of [
    ["NEXT_PUBLIC_SITE_URL", env.NEXT_PUBLIC_SITE_URL],
    ["VERCEL_PROJECT_PRODUCTION_URL", env.VERCEL_PROJECT_PRODUCTION_URL],
  ] as const) {
    const value = raw?.trim();
    if (!value) continue;

    try {
      return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      console.warn(`${name} is not an address ("${value}"), so it is ignored.`);
    }
  }

  return new URL("https://manifest.trip");
}
