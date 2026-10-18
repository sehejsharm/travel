/**
 * Islamic holidays that Singapore, Malaysia and Indonesia have published on a
 * different day from date-holidays, in 2026 and 2027.
 *
 * These countries decide the start of a Hijri month by the MABIMS criteria
 * (the crescent at least 3° high and 6.4° from the Sun at sunset), which can
 * put a month a day later than the Umm al-Qura calendar that date-holidays'
 * Hijri rules follow.
 *
 * - 2026: Shawwal 1447 started a day after Umm al-Qura. Indonesia's sidang
 *   isbat of 19 March 2026 found no crescent and set 1 Syawal on Saturday
 *   21 March, so the 2026 joint decree's Idul Fitri days off, Saturday 21
 *   and Sunday 22 March, are a day after the library's (Friday 20 March was
 *   collective leave, cuti bersama). The library already has Singapore's and
 *   Malaysia's Hari Raya on 21 March, so only Indonesia is moved.
 * - 2027: Shawwal and Dhu al-Hijjah 1448 and Rabi al-awwal and Rajab 1449
 *   start a day later, and the published lists agree with each other:
 *   - Singapore, Ministry of Manpower list for 2027 (18 June 2026): Hari Raya
 *     Puasa on Wednesday 10 March, Hari Raya Haji on Monday 17 May.
 *   - Indonesia, joint decree of three ministers (SKB 1205/3/2 of 2026): Idul
 *     Fitri on 10 and 11 March, Idul Adha on 17 May, the Prophet's Birthday
 *     on 15 August and the second Isra Mi'raj of the year on 26 December. The
 *     Islamic New Year (6 June) and the first Isra Mi'raj (5 January) are on
 *     the library's days already.
 *   - Malaysia, the 2027 federal list as calendar publishers give it
 *     (provisional for the Islamic days): Hari Raya Aidilfitri on 10 and
 *     11 March, Hari Raya Haji on 17 May, with the second day in Kedah,
 *     Kelantan, Perlis and Terengganu on 18 May, and Arafat Day on 16 May.
 *
 * Every date can still move a day when the moon is sighted, so the notes keep
 * date-holidays' caveat. Years after 2027 stay on the library's dates; when a
 * government publishes a year that differs, add it here. Indonesia's other
 * decree days (collective leave, Easter Sunday) are in library-fixes.mjs.
 */

const MOON_NOTE = "Islamic lunar date, estimated: the official date can differ by a day";

const entry = (date, name, kind, note = MOON_NOTE) => ({ date, name, kind, note });

/** One year's entries, or none in the other years. */
const only = (year, wanted, list) => (year === wanted ? list : []);

/** Drop rules for library days in one year only. */
const inYear = (year) => (name, ...dates) => ({ name, from: year, to: year, dates });
const in2026 = inYear(2026);
const in2027 = inYear(2027);

const ISLAMIC_SOUTHEAST_ASIA = [
  {
    country: "SG",
    source:
      "Ministry of Manpower, public holidays for 2027, https://www.mom.gov.sg/employment-practices/public-holidays",
    drop: [in2027("Hari Raya Puasa", "03-09"), in2027("Hari Raya Haji", "05-16")],
    entries: (year) =>
      only(year, 2027, [
        entry("2027-03-10", "Hari Raya Puasa", "public"),
        entry("2027-05-17", "Hari Raya Haji", "public"),
      ]),
  },
  {
    country: "MY",
    source:
      "Malaysia's federal and state public holidays for 2027, as published by CutiSekolah.com.my, https://cutisekolah.com.my/en/public-holidays-2027/",
    drop: [
      in2027("End of Ramadan (Eid al-Fitr)", "03-09"),
      in2027("Arafat Day", "05-15"),
      in2027("Feast of the Sacrifice (Eid al-Adha)", "05-16", "05-17"),
    ],
    entries: (year) =>
      only(year, 2027, [
        entry("2027-03-11", "End of Ramadan (Eid al-Fitr)", "public"),
        entry("2027-05-16", "Arafat Day", "optional", `Day off in Terengganu. ${MOON_NOTE}`),
        entry("2027-05-17", "Feast of the Sacrifice (Eid al-Adha)", "public"),
        entry(
          "2027-05-18",
          "Feast of the Sacrifice (Eid al-Adha)",
          "optional",
          `Day off in Kedah, Kelantan, Perlis and Terengganu. ${MOON_NOTE}`,
        ),
      ]),
  },
  {
    country: "ID",
    source:
      "Joint decrees of the Ministers of Religious Affairs, Manpower and Administrative Reform on national holidays in 2026 (Kepmenag 1497/2025, Menaker 2/2025, MenPANRB 5/2025), https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026, and in 2027 (SKB 1205, 3 and 2 of 2026), https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027",
    drop: [
      in2026("End of Ramadan (Eid al-Fitr)", "03-20"),
      in2027("End of Ramadan (Eid al-Fitr)", "03-09"),
      in2027("Feast of the Sacrifice (Eid al-Adha)", "05-16"),
      in2027("Birthday of Muhammad (Mawlid)", "08-14"),
      in2027("Laylat al-Mi'raj", "12-25"),
    ],
    entries: (year) => [
      ...only(year, 2026, [entry("2026-03-22", "End of Ramadan (Eid al-Fitr)", "public")]),
      ...only(year, 2027, [
        entry("2027-03-11", "End of Ramadan (Eid al-Fitr)", "public"),
        entry("2027-05-17", "Feast of the Sacrifice (Eid al-Adha)", "public"),
        entry("2027-08-15", "Birthday of Muhammad (Mawlid)", "public"),
        entry("2027-12-26", "Laylat al-Mi'raj", "public"),
      ]),
    ],
  },
];

export default ISLAMIC_SOUTHEAST_ASIA;
