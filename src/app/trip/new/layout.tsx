import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "New trip",
  description: "Start a trip with where, when and who. Everything else can wait.",
};

export default function NewTripLayout({ children }: { children: ReactNode }) {
  return children;
}
