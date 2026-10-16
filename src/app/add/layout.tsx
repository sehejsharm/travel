import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Add to your trip",
  description:
    "Drop in a booking email, a screenshot, a Reel link or a note, or type it in yourself, and Manifest files it and checks it.",
};

export default function AddLayout({ children }: { children: ReactNode }) {
  return children;
}
