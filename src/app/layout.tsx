import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { ServiceWorker } from "@/components/service-worker";
import { Splash } from "@/components/splash";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

// No web fonts: every platform's own system face, San Francisco on Apple
// devices. The stack lives in globals.css.

export const metadata: Metadata = {
  // Resolves the social image to an absolute URL at build time.
  metadataBase: siteUrl(),
  // Each screen's layout names itself; this adds the brand after it.
  title: { template: "%s · Manifest", default: "Manifest" },
  description:
    "Drop in your bookings and Manifest files them into one trip, then checks it for visa rules, passport expiry, tight connections and refund deadlines.",
  applicationName: "Manifest",
  appleWebApp: { capable: true, title: "Manifest", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  /*
   * No title, description or url here on purpose. Next fills the first two
   * from each screen's own, and a url would point every screen's card at the
   * home page. The image comes from opengraph-image.tsx, and X reads the same
   * one: Next copies the Open Graph image into the twitter tags.
   *
   * A screen that sets its own openGraph replaces this whole object and loses
   * the image with it, so screens set only a title and a description.
   */
  openGraph: { type: "website", siteName: "Manifest", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1116" },
  ],
  width: "device-width",
  initialScale: 1,
  // The app has its own scroll containers; zooming the shell breaks the layout.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased">
      <head>
        {/*
          Runs before first paint so the splash knows which of its two states
          to show without React reading storage during render.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(!localStorage.getItem("manifest.state.v2"))document.documentElement.dataset.firstRun="true"}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans min-h-dvh">
        <Splash />
        <AppShell>{children}</AppShell>
        <ServiceWorker />
      </body>
    </html>
  );
}
