import type { Metadata } from "next";
import type { ReactNode } from "react";

// The screen is a client component, so its title and description live here.
export const metadata: Metadata = {
  /*
   * A plain string title here would end the root's template for /trip/new
   * below it: Next hands a template down only from a layout that sets one.
   */
  title: { default: "Trip settings", template: "%s · Manifest" },
  description:
    "Change the trip's details, travellers and interests, switch between your trips, or start another.",
};

export default function TripSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
