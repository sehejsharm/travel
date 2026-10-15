import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  title: "Filing cabinet",
  description:
    "Everything filed for your trip in one place, sorted into bookings, places, activities and purchases.",
};

export default function CabinetLayout({ children }: { children: ReactNode }) {
  return children;
}
