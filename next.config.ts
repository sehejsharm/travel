import type { NextConfig } from "next";

/**
 * Sent with every response, pages and API routes alike.
 *
 * There is deliberately no Content-Security-Policy here: a policy strict enough
 * to matter has to account for the splash's inline script, the Google Maps
 * embeds and Next's own runtime, and a wrong one breaks the app silently in
 * production. That is a separate change, tested in a browser.
 */
const SECURITY_HEADERS = [
  // Vercel already redirects http to https. This tells the browser to skip the
  // http attempt entirely for two years, on every subdomain. `preload` (the
  // browsers' built-in list, which is slow to leave) is the owner's call.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nothing frames Manifest. The TWA and the Capacitor shell are not frames.
  { key: "X-Frame-Options", value: "DENY" },
  {
    // Off: what the app never asks for. The Add tab's camera is a file input
    // with `capture`, which opens the system camera and needs no permission,
    // and nothing reads location. On, for this origin only: the clipboard
    // (Add reads a pasted link; More copies a share link) and the share sheet.
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "browsing-topics=()",
      "clipboard-read=(self)",
      "clipboard-write=(self)",
      "web-share=(self)",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  // Says nothing a visitor needs, and names the framework to anyone probing.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      // robots.txt keeps crawlers off the API; this keeps any answer that was
      // fetched anyway out of an index.
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

export default nextConfig;
