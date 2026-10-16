import { describe, expect, it, vi } from "vitest";
import { extractDeterministic } from "./deterministic";
import { fetchPageMetadata } from "./og";
import { findDates, findMoney, findRefundDeadline, offsetSuffix } from "./patterns";
import { ESCALATION_THRESHOLD } from "./types";
import { detectLink, isFetchableLink, type DetectedLink } from "./url";

const TODAY = new Date("2026-09-09T00:00:00Z");

describe("patterns", () => {
  it("reads money written with a symbol or a code", () => {
    expect(findMoney("Total paid ₹52,400")).toEqual({ amount: 52400, currency: "INR" });
    expect(findMoney("Total ¥168,000 for 7 nights")).toEqual({ amount: 168000, currency: "JPY" });
    expect(findMoney("charged USD 249.50")).toEqual({ amount: 249.5, currency: "USD" });
  });

  it("does not invent a price when there is none", () => {
    expect(findMoney("free walking tour, meet at 9")).toBeUndefined();
  });

  it("reads day-first, month-first and ISO dates with their times", () => {
    expect(findDates("Departs 14 Oct 2026 19:55", 2026)[0]).toMatchObject({
      date: "2026-10-14",
      time: "19:55",
    });
    expect(findDates("Oct 15, 2026 at 7:25 am", 2026)[0]).toMatchObject({
      date: "2026-10-15",
      time: "07:25",
    });
    expect(findDates("2026-10-22T11:00", 2026)[0]).toMatchObject({
      date: "2026-10-22",
      time: "11:00",
    });
  });

  it("converts pm times to 24 hour", () => {
    expect(findDates("18 Oct 2026 7:30 pm", 2026)[0].time).toBe("19:30");
  });

  it("marks slash dates ambiguous only when both halves could be a month", () => {
    expect(findDates("on 05/10/2026", 2026)[0]).toMatchObject({
      date: "2026-10-05",
      ambiguous: true,
    });
    expect(findDates("on 22/10/2026", 2026)[0]).toMatchObject({
      date: "2026-10-22",
      ambiguous: false,
    });
  });

  it("formats half-hour offsets", () => {
    expect(offsetSuffix(5.5)).toBe("+05:30");
    expect(offsetSuffix(9)).toBe("+09:00");
    expect(offsetSuffix(-5)).toBe("-05:00");
  });

  it("separates a cancellation deadline from a non-refundable rate", () => {
    expect(findRefundDeadline("Free cancellation until 14 Sep 2026", 2026).iso).toBe(
      "2026-09-14T00:00:00",
    );
    expect(findRefundDeadline("This rate is non-refundable", 2026)).toEqual({
      nonRefundable: true,
    });
  });
});

describe("deterministic extraction", () => {
  it("pulls a flight booking apart without needing the model", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "gmail",
      text: `Your Air India booking is confirmed
PNR: 7QW2LM
Passenger: Sehej Sharma
AI 142 · DEL → HND
Departs 14 Oct 2026 19:55
Arrives 15 Oct 2026 07:25
Total paid ₹52,400`,
    });

    expect(result.draft.category).toBe("booking");
    expect(result.draft.bookingKind).toBe("flight");
    expect(result.draft.place?.airport).toBe("DEL");
    expect(result.draft.arrivalPlace?.airport).toBe("HND");
    expect(result.draft.confirmationCode).toBe("7QW2LM");
    expect(result.draft.travelerName).toBe("Sehej Sharma");
    expect(result.draft.cost).toEqual({ amount: 52400, currency: "INR" });
    // Departure takes the origin's offset, arrival the destination's.
    expect(result.draft.startsAt).toBe("2026-10-14T19:55:00+05:30");
    expect(result.draft.endsAt).toBe("2026-10-15T07:25:00+09:00");
    expect(result.confidence).toBeGreaterThanOrEqual(ESCALATION_THRESHOLD);
  });

  it("keeps check-in and check-out apart on a hotel booking", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "gmail",
      text: `Booking confirmed at Hotel Gracery
Confirmation number: BK99120
Check-in: 15 Oct 2026, 15:00
Check-out: 22 Oct 2026, 11:00
Total ¥168,000
Free cancellation until 14 Sep 2026`,
    });

    expect(result.draft.bookingKind).toBe("lodging");
    expect(result.draft.startsAt?.slice(0, 10)).toBe("2026-10-15");
    expect(result.draft.endsAt?.slice(0, 10)).toBe("2026-10-22");
    expect(result.draft.refundableUntil?.slice(0, 10)).toBe("2026-09-14");
  });

  it("grounds a place named in a caption", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "reel",
      text: "this tiny standing sushi bar in tsukiji is unreal, cash only",
    });

    expect(result.draft.place?.name).toBe("Tsukiji Outer Market");
    expect(result.draft.place?.point).toBeDefined();
  });

  it("comes back under-confident on a caption with nothing structured in it", () => {
    const result = extractDeterministic({
      today: TODAY,
      source: "tiktok",
      text: "saving this for later, looks unreal",
    });

    expect(result.confidence).toBeLessThan(ESCALATION_THRESHOLD);
    expect(result.draft.cost).toBeUndefined();
    expect(result.draft.startsAt).toBeUndefined();
  });
});

describe("which pasted links the server will fetch", () => {
  it("still recognises every form of link it read before", () => {
    const cases: [string, Partial<DetectedLink>][] = [
      ["https://www.instagram.com/reel/C9xAbc123/", { platform: "Instagram", source: "reel", ref: "C9xAbc123" }],
      ["https://instagram.com/reel/C9xAbc123", { platform: "Instagram", ref: "C9xAbc123" }],
      ["https://www.instagram.com/reels/C9xAbc123/", { platform: "Instagram", ref: "C9xAbc123" }],
      ["https://www.instagram.com/p/C9x_Abc-12/?igsh=abc", { platform: "Instagram", ref: "C9x_Abc-12" }],
      [
        "https://www.tiktok.com/@some.one/video/7412345678901234567?lang=en",
        { platform: "TikTok", source: "tiktok", ref: "7412345678901234567" },
      ],
      ["https://tiktok.com/@someone/video/7412345678901234567", { platform: "TikTok" }],
      ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", { platform: "YouTube", source: "youtube", ref: "dQw4w9WgXcQ" }],
      ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42", { platform: "YouTube", ref: "dQw4w9WgXcQ" }],
      ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", { platform: "YouTube", ref: "dQw4w9WgXcQ" }],
      ["https://www.youtube.com/shorts/abcDEF123", { platform: "YouTube", ref: "abcDEF123" }],
      ["https://youtu.be/dQw4w9WgXcQ?si=xyz", { platform: "YouTube", ref: "dQw4w9WgXcQ" }],
    ];

    for (const [url, expected] of cases) {
      expect(detectLink(`saving this ${url} for japan`), url).toMatchObject(expected);
    }
  });

  it("only ever hands back an https link, upgrading an old http one", () => {
    const link = detectLink("http://www.instagram.com/reel/C9xAbc123/");
    expect(link?.url).toBe("https://www.instagram.com/reel/C9xAbc123/");
    expect(detectLink("https://youtu.be/dQw4w9WgXcQ")?.oembed).toContain(
      encodeURIComponent("https://youtu.be/dQw4w9WgXcQ"),
    );
  });

  it("refuses a platform's name anywhere but the hostname", () => {
    for (const attack of [
      "https://attacker.example/instagram.com/reel/x",
      "https://attacker.example/?u=instagram.com/reel/abc",
      "https://instagram.com.attacker.example/reel/abc",
      "https://evilinstagram.com/reel/abc",
      "https://instagram.com@attacker.example/reel/abc",
      "https://attacker.example/www.tiktok.com/@a/video/123",
      "https://tiktok.com.attacker.example/@a/video/123",
      "https://attacker.example/youtube.com/watch?v=dQw4w9WgXcQ",
      "https://attacker.example/youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com.attacker.example/watch?v=dQw4w9WgXcQ",
      "http://169.254.169.254/latest/meta-data/instagram.com/reel/x",
      "http://localhost:3000/instagram.com/reel/x",
    ]) {
      expect(detectLink(attack), attack).toBeUndefined();
    }
  });

  it("refuses the real host on a port, with credentials, or with a trailing dot", () => {
    for (const odd of [
      "https://www.instagram.com:8443/reel/abc",
      "https://user:pass@www.instagram.com/reel/abc",
      "https://www.instagram.com./reel/abc",
    ]) {
      expect(detectLink(odd), odd).toBeUndefined();
    }
  });

  it("refuses a real host's pages that are not a post", () => {
    expect(detectLink("https://www.instagram.com/accounts/login/")).toBeUndefined();
    expect(detectLink("https://www.youtube.com/results?search_query=kyoto")).toBeUndefined();
  });

  it("skips a bad link and finds the real one after it", () => {
    expect(
      detectLink("https://attacker.example/instagram.com/reel/x then https://www.instagram.com/reel/C9xAbc123/"),
    ).toMatchObject({ url: "https://www.instagram.com/reel/C9xAbc123/", ref: "C9xAbc123" });
  });

  it("holds a fetch target to https on the platform's own hosts", () => {
    expect(isFetchableLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "YouTube")).toBe(true);
    expect(isFetchableLink("http://www.youtube.com/watch?v=dQw4w9WgXcQ", "YouTube")).toBe(false);
    expect(isFetchableLink("https://www.instagram.com/reel/x", "YouTube")).toBe(false);
    expect(isFetchableLink("https://consent.youtube.com/m?continue=x", "YouTube")).toBe(false);
    expect(isFetchableLink("not a url")).toBe(false);
  });
});

describe("reading a link's page without being sent elsewhere", () => {
  const PAGE = `<html><head>
    <meta property="og:title" content="Tsukiji at dawn" />
    <meta property="og:description" content="Standing sushi bar, cash only" />
  </head></html>`;

  function page(url = ""): Response {
    const response = new Response(PAGE, { status: 200, headers: { "content-type": "text/html" } });
    if (url) Object.defineProperty(response, "url", { value: url });
    return response;
  }

  function redirect(location: string, status = 302): Response {
    return new Response(null, { status, headers: { location } });
  }

  const reel = detectLink("https://www.instagram.com/reel/C9xAbc123/")!;
  const short = detectLink("https://youtu.be/dQw4w9WgXcQ")!;

  it("reads the tags from the link itself, asking fetch not to follow redirects", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(page());
    const found = await fetchPageMetadata(reel, fetchImpl as unknown as typeof fetch);

    expect(found).toMatchObject({ title: "Tsukiji at dawn", description: "Standing sushi bar, cash only" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toBe("https://www.instagram.com/reel/C9xAbc123/");
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("follows a redirect that stays on the platform, relative or absolute", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 301))
      .mockResolvedValueOnce(redirect("/watch?v=dQw4w9WgXcQ&feature=youtu.be", 307))
      .mockResolvedValueOnce(page());

    await expect(fetchPageMetadata(short, fetchImpl as unknown as typeof fetch)).resolves.toMatchObject({
      title: "Tsukiji at dawn",
    });
    expect(fetchImpl.mock.calls.map((call) => call[0])).toEqual([
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&feature=youtu.be",
    ]);
  });

  it("refuses a redirect off the platform, and never requests it", async () => {
    for (const location of [
      "https://attacker.example/",
      "http://169.254.169.254/latest/meta-data/",
      "http://www.instagram.com/reel/C9xAbc123/",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.instagram.com:8443/reel/C9xAbc123/",
    ]) {
      const fetchImpl = vi.fn().mockResolvedValueOnce(redirect(location)).mockResolvedValue(page());
      await expect(fetchPageMetadata(reel, fetchImpl as unknown as typeof fetch), location).resolves.toBeUndefined();
      expect(fetchImpl, location).toHaveBeenCalledTimes(1);
    }
  });

  it("gives up on a redirect with nowhere to go, or one that never ends", async () => {
    const nowhere = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    await expect(fetchPageMetadata(reel, nowhere as unknown as typeof fetch)).resolves.toBeUndefined();

    const loop = vi.fn().mockImplementation(async () => redirect("https://www.instagram.com/reel/C9xAbc123/"));
    await expect(fetchPageMetadata(reel, loop as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(loop.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("refuses a page a fetch reached on its own somewhere off the platform", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(page("https://attacker.example/landing"));
    await expect(fetchPageMetadata(reel, fetchImpl as unknown as typeof fetch)).resolves.toBeUndefined();
  });

  it("will not fetch a link that did not come from the detector", async () => {
    const forged: DetectedLink = {
      url: "https://attacker.example/instagram.com/reel/x",
      source: "reel",
      platform: "Instagram",
    };
    const fetchImpl = vi.fn().mockResolvedValue(page());
    await expect(fetchPageMetadata(forged, fetchImpl as unknown as typeof fetch)).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
