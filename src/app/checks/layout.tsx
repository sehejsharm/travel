import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Trip checks",
  description:
    "What needs attention before you go, from entry rules and passport expiry to tight connections, plus your pre-trip tasks and packing list.",
};

export default function ChecksLayout({ children }: { children: ReactNode }) {
  return children;
}
