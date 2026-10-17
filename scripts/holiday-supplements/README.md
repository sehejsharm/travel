# Holiday supplements

`scripts/build-holidays.mjs` builds the app's holiday calendar
(`src/lib/reference/holiday-data/`, 2026 to 2050) from
[date-holidays](https://github.com/commenthol/date-holidays), then merges in
every `*.mjs` module in this folder. A supplement adds what the library does
not have (festivals, holidays it misses) or corrects a day it has wrong.

After adding or changing a supplement, run:

```sh
node scripts/build-holidays.mjs          # rewrite the data, print coverage
node scripts/build-holidays.mjs --check  # fail if the data is out of date
```

and commit the regenerated files with the supplement.

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
- `note` is optional, in plain English, and shown to travellers.
- `source` says where the dates come from, with a URL. It is listed on the
  Licences page, so cite the publisher and keep within its licence.
- Return `[]` for a year with nothing to add. If a date is not known for a
  year, leave that year out rather than guessing.

## How entries merge

- Two entries are the same holiday when their dates match and their names
  match, ignoring case, accents, apostrophes and punctuation ("St Patrick's
  Day" and "St. Patrick’s Day" are the same).
- A supplement entry replaces a library entry that is the same holiday, so to
  correct the library's kind or note, repeat its exact date and name.
- Anything else is added. Dates outside 2026 to 2050 are ignored.
- Modules are applied in file-name order; when two supplements give the same
  holiday, the later file wins.
- A supplement cannot remove a library entry or move one to another date. A
  library entry on the wrong date stays, so report it upstream to
  date-holidays.
- A malformed supplement (a bad country code, date or kind, or no source)
  stops the build with the file name and the problem.

A country date-holidays does not cover gets a file of its own from its
supplements alone.
