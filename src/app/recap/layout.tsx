import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Trip recap",
  description: "What the trip cost, its busiest day, and where each booking and idea came from.",
};

export default function RecapLayout({ children }: { children: ReactNode }) {
  return children;
}
