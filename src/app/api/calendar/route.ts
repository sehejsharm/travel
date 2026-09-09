import { toCalendar } from "@/lib/calendar";
import { getTrip, listItems } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const trip = getTrip();
  const calendar = toCalendar(trip, listItems(trip.id));
  const filename = `${trip.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;

  return new Response(calendar, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
