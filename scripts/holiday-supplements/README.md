# Holiday supplements

`scripts/build-holidays.mjs` builds the app's holiday calendar
(`src/lib/reference/holiday-data/`, 2026 to 2050) from
[date-holidays](https://github.com/commenthol/date-holidays), then merges in
every supplement module in this folder. A supplement adds what the library does
not have (festivals, holidays it misses, countries it does not cover), drops
library entries that are wrong, and corrects a day it has wrong.

After adding or changing a supplement, run:

```sh
node scripts/build-holidays.mjs          # rewrite the data, print coverage
node scripts/build-holidays.mjs --check  # fail if the data is out of date
```

and commit the regenerated files with the supplement. To try a change without
touching the committed data, write somewhere else:
`node scripts/build-holidays.mjs --out /tmp/holidays`.

## Which files are supplements

Every `*.mjs` file in this folder, in file-name order, except:

- a file whose name starts with `_` (`_shared.mjs`): a helper that
  supplements import, not a supplement itself;
- a file whose name ends in `.test.mjs`.

Tests belong in `src/lib/reference/<name>-holidays.test.ts` (vitest), which
can import a supplement's `.mjs` directly.

## Module shape

Each module default-exports an array. Every element covers one country:

```js
// A lunar festival moves every year, so its dates come from the source, one
// per year. (The dates below are placeholders, not real ones.)
const FESTIVAL = { 2026: "2026-MM-DD", 2027: "2027-MM-DD" };

export default [
  {
    country: "XX", // ISO 3166-1 alpha-2, upper case
    source: "Who publishes the dates, https://example.org/holidays",
    // Optional: library entries to remove before merging (see below).
    drop: [
      { name: "Example Holiday", from: 2027 },
      { name: /Full Moon Day$/, from: 2027, to: 2050 },
      { name: "Regional Day", note: /Kerala/ },
    ],
    // Optional: the last step, given the country's merged entries (see below).
    // finish(entries) { return entries; },
    entries(year) {
      // Called once for every year from 2026 to 2050.
      return [
        // A fixed-date day can be computed.
        { date: `${year}-05-01`, name: "Example Day", kind: "public" },
        // A moving one is looked up, and left out when it is not known.
        ...(FESTIVAL[year]
          ? [{ date: FESTIVAL[year], name: "Example Festival", kind: "festival", note: "Parades in the old town" }]
          : []),
      ];
    },
  },
];
```

- `date` is `YYYY-MM-DD`, on the country's own calendar. A holiday lasting
  several days needs one entry per day, all with the same name.
- `kind` is one of:
  - `"public"`: a day off. Shops, offices and many museums close.
  - `"bank"`: a bank holiday. Banks and many offices close.
  - `"optional"`: a day off in some regions or for some people. Say which in
    the note.
  - `"observance"`: marked, but not a day off.
  - `"festival"`: a cultural or religious festival, or a big event, that is not
    a day off.
- `note` is optional, in plain English, and shown to travellers. A computed
  lunar or sighting-based date ends its note with "Lunar date, estimated: the
  official date can differ by a day." (Islamic dates: "Islamic lunar date,
  estimated: the official date can differ by a day", as the library writes it.)
- `source` says where the dates come from, with a URL. It is listed on the
  Licences page, so cite the publisher and keep within its licence.
- Return `[]` for a year with nothing to add. If a date is not known for a
  year, leave that year out rather than guessing.
- Supplements must be deterministic and independent of the machine's time
  zone: `Date.UTC` and `getUTC*` only, no network, no randomness.

### Dropping library entries

`drop` lists rules; each removes the date-holidays entries it matches, for its
own country only, before anything is merged. It never removes another
supplement's entries.

- `name` (required): a string, matched the way the merge matches names
  (ignoring case, accents, apostrophes and punctuation), or a RegExp, tested
  against the library's cleaned English name (the name as it appears in the
  generated JSON; a name the generator aliases is matched under its library
  name too).
- `from`, `to`: the first and last year, inclusive. They default to 2026 and
  2050.
- `dates`: a list of `"MM-DD"` month-days; the rule then only drops entries on
  those days.
- `note`: a RegExp; the rule then only drops entries whose note matches.
  Regional days carry notes like "Day off in Kerala".

Every rule must drop at least one entry, or the build stops naming the file and
the rule: check the name against the library's YAML
(`node_modules/date-holidays/data/countries/XX.yaml`) and the current JSON
first. A malformed rule (an unknown field, a bad year, month-day or pattern)
stops the build too. The build summary lists how many library entries each
supplement dropped.

To move a library holiday to another day, drop it and add an entry on the
right day. To change its kind or note, repeat its exact date and name: the
entry replaces the library's (see below).

### Finishing

`finish(entries)` is for a rule that needs the whole calendar, such as a
substitute day for every holiday that falls on a Sunday (Malaysia), which
has to see the library's days, every supplement's and their moved dates. It
gets the country's entries once everything is merged (all years, as
`{ date, kind, name, note }`, a copy) and returns the whole list again; the
build checks it as it checks `entries`. A country's supplements finish in
file order. `finishEntries()` in `build-holidays.mjs` does the same for the
tests.

## How entries merge

- Two entries are the same holiday when their dates match and their names
  match, ignoring case, accents, apostrophes and punctuation ("St Patrick's
  Day" and "St. Patrick’s Day" are the same).
- Library entries named in a supplement's `drop` are removed first.
- A supplement entry replaces a library entry that is the same holiday, so to
  correct the library's kind or note, repeat its exact date and name.
- Anything else is added. Dates outside 2026 to 2050 are ignored.
- Modules are applied in file-name order; when two supplements give the same
  holiday, the later file wins.
- A malformed supplement (a bad country code, date, kind or drop rule, or no
  source) stops the build with the file name and the problem.

A country date-holidays does not cover gets a file of its own from its
supplements alone. It needs its complete list of public holidays for every
year, since the coverage tests want a day off in each.

## What the generator corrects itself

Before supplements are merged, `build-holidays.mjs` fixes a few things in the
library's own data, so a supplement does not need to:

- `RULE_FIXES`: library rules that disagree with the law (Korean New Year
  starts the day before, China's and Taiwan's New Year spans, China's second
  Labour Day, Kazakhstan's Nauryz substitutes, Kenya's Mazingira Day,
  Nigeria's Children's Day, Youth Day and Islamic New Year, St Helena's
  King's Birthday).
- `NAME_ALIASES`: one holiday under two library names on one day, merged under
  one name (the US "Day after Thanksgiving Day", Vietnam's "Vietnamese New Year
  Holidays", Russia's regional names for Radonitsa and the two Eids).
- `ENGLISH_NAMES`: names the library has no English for, or has wrong
  (typos, mistranslations, the Queen's Birthday under a king). A name is
  looked up without its " (substitute day)" suffix, so its substitutes
  follow, and the build summary lists any untranslated library name left.
- `STATE_GAPS`: in countries whose state calendars say so (Australia,
  Switzerland, the United Kingdom, Malaysia, St Helena), a national day off
  that some regions do not keep gets "Not a day off in ...", and becomes
  `optional` when more than a third of them do not.
- `REGION_NAMES`: regions named otherwise in "Day off in ..." notes.
- `LIBRARY_NOTES`: a note added to a library holiday, by country and cleaned
  name, where a traveller needs one (Vietnam's Tết days, which the
  government sets each year; Russia's names for its Crimea days).
  `NOTE_FIXES` corrects typos in the library's own notes.
- A library `public` day whose note gives it to one group only (women,
  Muslims, the armed forces) becomes `optional`.
- The Chinese, Korean and Vietnamese lunisolar calendars, which it recomputes
  astronomically: date-holidays puts 2033's leap month in the wrong place and
  lets its day count slip a day in some months, and every library rule on an
  affected day is evaluated again on the right one.

A supplement that needs a Chinese, Korean or Vietnamese lunar date can use the
same calendar:

```js
import { lunisolarDate } from "../build-holidays.mjs";

lunisolarDate("chinese", 2033, 8, 15); // "2033-09-08", Mid-Autumn
lunisolarDate("korean", 2027, 1, 1); // "2027-02-07", Seollal
lunisolarDate("vietnamese", 2027, 1, 0); // "2027-02-05", the eve of Tết
```

Its arguments are the calendar, the lunar year (the Gregorian year its first
month starts in), the month, the day (0 is the day before the 1st) and, last,
`true` for a leap month.
