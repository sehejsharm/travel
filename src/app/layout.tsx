import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { ServiceWorker } from "@/components/service-worker";
import { Splash } from "@/components/splash";
import "./globals.css";

// No web fonts: every platform's own system face, San Francisco on Apple
// devices. The stack lives in globals.css.

export const metadata: Metadata = {
  // Resolves the social image to an absolute URL at build time.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://manifest.trip"),
  title: "Manifest",
  description: "Everything about your trip, in one file.",
  applicationName: "Manifest",
  appleWebApp: { capable: true, title: "Manifest", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
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
