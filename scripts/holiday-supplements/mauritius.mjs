/**
 * Mauritius keeps one of two Catholic feasts as a public holiday each year,
 * in turn: the Assumption (15 August) in even years and All Saints' Day
 * (1 November) in odd years. date-holidays has All Saints' Day every year and
 * no Assumption.
 *
 * The turn is the one the published calendars show: All Saints' Day in 2025,
 * the Assumption in 2026 and All Saints' Day in 2027 (timeanddate.com and
 * HolidayDB; CalendarLabs lists the Assumption in 2027). The Prime Minister's
 * Office notice for each year is the authority: check it when it comes out.
 * The feast that is not a day off that year is still listed, as an
 * observance.
 *
 * Deterministic and independent of the machine's time zone.
 */

const ALTERNATES = "Mauritius alternates the Assumption (even years) and All Saints' Day (odd years) as a public holiday";

const MAURITIUS = [
  {
    country: "MU",
    source:
      "Public Holidays Act, as the yearly Prime Minister's Office notices apply it, listed by timeanddate.com, https://www.timeanddate.com/holidays/mauritius/",
    drop: [{ name: "All Saints' Day" }],
    entries: (year) => {
      const even = year % 2 === 0;
      return [
        {
          date: `${year}-08-15`,
          name: "Assumption",
          kind: even ? "public" : "observance",
          note: even ? ALTERNATES : `Not a day off this year. ${ALTERNATES}`,
        },
        {
          date: `${year}-11-01`,
          name: "All Saints' Day",
          kind: even ? "observance" : "public",
          note: even ? `Not a day off this year. ${ALTERNATES}` : ALTERNATES,
        },
      ];
    },
  },
];

export default MAURITIUS;
