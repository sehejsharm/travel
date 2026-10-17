/**
 * Fiji's national days, as the Cabinet's yearly lists give them.
 *
 * date-holidays still has Constitution Day (7 September), which is not on the
 * 2025 or 2026 lists, and lacks Girmit Day and Ratu Sir Lala Sukuna Day,
 * which have been days off again since 2023. The Cabinet sets each year's
 * days and usually moves these two to a Monday or a Friday:
 *
 * - Girmit Day, for the arrival of the first indentured labourers from India
 *   on 14 May 1879: Monday 12 May 2025 (14 May was a Wednesday), Friday
 *   15 May 2026 (a Thursday).
 * - Ratu Sir Lala Sukuna Day, 30 May: Friday 30 May 2025, Friday 29 May 2026
 *   (a Saturday).
 *
 * Both fit one rule: the Monday or Friday nearest the date, and the Monday
 * before when the date is a Wednesday. Years after 2026 use it, and their
 * notes say the day is an estimate. Diwali is in hindu-buddhist-diaspora.mjs.
 *
 * The 2026 list also moves two days the library has: the Prophet's Birthday
 * to Monday 24 August (the library has Tuesday 25 August) and Boxing Day,
 * a Saturday, to Monday 28 December.
 *
 * Deterministic and independent of the machine's time zone: Date.UTC only.
 */

const DAY_MS = 86_400_000;
const ESTIMATE = "Estimated: the Cabinet sets the day each year, usually a Monday or Friday near it";

function ymd(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

function weekday(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The Monday or Friday nearest a date, and the Monday before a Wednesday:
 * Saturday goes to Friday, Sunday and Tuesday to Monday, Thursday to Friday.
 */
export function nearestMondayOrFriday(iso) {
  const shift = [1, 0, -1, -2, 1, 0, -1][weekday(iso)];
  return addDays(iso, shift);
}

const PUBLISHED = {
  2026: { girmit: "2026-05-15", sukuna: "2026-05-29" },
};

function nationalDays(year) {
  const published = PUBLISHED[year];
  const girmit = published?.girmit ?? nearestMondayOrFriday(ymd(year, 5, 14));
  const sukuna = published?.sukuna ?? nearestMondayOrFriday(ymd(year, 5, 30));
  const estimate = published ? "" : ` ${ESTIMATE}.`;
  return [
    {
      date: girmit,
      name: "Girmit Day",
      kind: "public",
      note: `Marks the arrival of the first indentured labourers from India, on 14 May 1879.${estimate}`,
    },
    {
      date: sukuna,
      name: "Ratu Sir Lala Sukuna Day",
      kind: "public",
      note: `Honours the Fijian chief and statesman Ratu Sir Lala Sukuna.${estimate}`,
    },
  ];
}

const FIJI = [
  {
    country: "FJ",
    source:
      "Cabinet's public holiday lists for 2025 and 2026, as reported by The Fiji Times and FBC News, https://www.fijitimes.com.fj/cabinet-confirms-eleven-2026-public-holidays/",
    drop: [
      { name: "Constitution Day" },
      { name: "Birthday of Muhammad (Mawlid)", from: 2026, to: 2026, dates: ["08-25"] },
    ],
    entries: (year) => [
      ...nationalDays(year),
      ...(year === 2026
        ? [
            {
              date: "2026-08-24",
              name: "Birthday of Muhammad (Mawlid)",
              kind: "public",
              note: "Prophet Mohammed's Birthday, as the Cabinet set it for 2026",
            },
            {
              date: "2026-12-28",
              name: "Boxing Day (substitute day)",
              kind: "public",
              note: "Boxing Day falls on Saturday 26 December",
            },
          ]
        : []),
    ],
  },
];

export default FIJI;
