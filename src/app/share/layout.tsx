import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Shared trip",
  description: "A read-only copy of a trip someone planned in Manifest.",
  // The trip rides in the link's fragment, so the page a crawler sees is an
  // empty shell; and a trip someone sent a friend is not for search results.
  robots: { index: false },
};

export default function SharedTripLayout({ children }: { children: ReactNode }) {
  return children;
}
