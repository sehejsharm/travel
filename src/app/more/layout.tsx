import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Export and share",
  description:
    "Put the trip in your calendar, share a read-only link, and see what to know on the ground at your destination.",
};

export default function MoreLayout({ children }: { children: ReactNode }) {
  return children;
}
