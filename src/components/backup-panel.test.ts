import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DESTRUCTIVE_BUTTON_CLASSES } from "./styles";
import { BackupPanel, formatBytes } from "./backup-panel";

describe("the backup panel's sizes", () => {
  it("keeps small sizes as they were", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2.4 * 1024 * 1024)).toBe("2.4 MB");
  });

  it("gives a browser's quota in gigabytes, not a five-digit count of megabytes", () => {
    // What headless Chrome reported: 154811.8 MB.
    expect(formatBytes(154811.8 * 1024 * 1024)).toMatch(/^151\D2 GB$/);
    // Grouped in the reader's own locale: "1,200.5" in English.
    expect(formatBytes(1200.5 * 1024 ** 3)).toMatch(/^1\D200\D5 GB$/);
  });
});

describe("the backup panel's delete", () => {
  it("is drawn red from the first tap, not quiet grey", () => {
    const html = renderToStaticMarkup(createElement(BackupPanel));
    const button = html.match(/<button([^>]*)>Delete all my data<\/button>/)?.[1] ?? "";

    expect(button).toContain(DESTRUCTIVE_BUTTON_CLASSES);
    expect(button).not.toContain("text-ink-soft");
  });
});
