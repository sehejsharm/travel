import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Break off from the group",
  description:
    "Pick what you are after for a while on your own, and Manifest works out where to meet the others again.",
};

export default function DivertLayout({ children }: { children: ReactNode }) {
  return children;
}
