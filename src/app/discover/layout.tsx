import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Things to do",
  description:
    "Suggestions for your destination, grouped under the interests you pick, each one naming where it came from.",
};

export default function DiscoverLayout({ children }: { children: ReactNode }) {
  return children;
}
