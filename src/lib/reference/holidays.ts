/**
 * Public holidays that close museums, banks and offices, and turn transport
 * into a crush. Only the destinations covered elsewhere in the reference data,
 * for 2026.
 */
export interface Holiday {
  date: string;
  name: string;
}

const HOLIDAYS: Record<string, Holiday[]> = {
  JP: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-01-12", name: "Coming of Age Day" },
    { date: "2026-02-11", name: "National Foundation Day" },
    { date: "2026-02-23", name: "The Emperor's Birthday" },
    { date: "2026-03-20", name: "Vernal Equinox Day" },
    { date: "2026-04-29", name: "Shōwa Day" },
    { date: "2026-05-03", name: "Constitution Memorial Day" },
    { date: "2026-05-04", name: "Greenery Day" },
    { date: "2026-05-05", name: "Children's Day" },
    { date: "2026-07-20", name: "Marine Day" },
    { date: "2026-08-11", name: "Mountain Day" },
    { date: "2026-09-21", name: "Respect for the Aged Day" },
    { date: "2026-09-23", name: "Autumnal Equinox Day" },
    { date: "2026-10-12", name: "Sports Day" },
    { date: "2026-11-03", name: "Culture Day" },
    { date: "2026-11-23", name: "Labour Thanksgiving Day" },
  ],
  TH: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-04-13", name: "Songkran" },
    { date: "2026-04-14", name: "Songkran" },
    { date: "2026-04-15", name: "Songkran" },
    { date: "2026-05-01", name: "Labour Day" },
    { date: "2026-12-05", name: "King Bhumibol Memorial Day" },
    { date: "2026-12-10", name: "Constitution Day" },
  ],
  IN: [
    { date: "2026-01-26", name: "Republic Day" },
    { date: "2026-08-15", name: "Independence Day" },
    { date: "2026-10-02", name: "Gandhi Jayanti" },
  ],
  GB: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-06", name: "Easter Monday" },
    { date: "2026-05-04", name: "Early May bank holiday" },
    { date: "2026-05-25", name: "Spring bank holiday" },
    { date: "2026-08-31", name: "Summer bank holiday" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-26", name: "Boxing Day" },
  ],
  SG: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-05-01", name: "Labour Day" },
    { date: "2026-08-09", name: "National Day" },
    { date: "2026-12-25", name: "Christmas Day" },
  ],
};

/** Holidays falling between two dates, inclusive. */
export function holidaysBetween(countryCode: string, from: string, to: string): Holiday[] {
  return (HOLIDAYS[countryCode.toUpperCase()] ?? []).filter(
    (holiday) => holiday.date >= from.slice(0, 10) && holiday.date <= to.slice(0, 10),
  );
}

export function isHoliday(countryCode: string, date: string): Holiday | undefined {
  return (HOLIDAYS[countryCode.toUpperCase()] ?? []).find(
    (holiday) => holiday.date === date.slice(0, 10),
  );
}
