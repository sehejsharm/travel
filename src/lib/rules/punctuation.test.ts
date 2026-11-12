import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * The checks' own messages follow the app's copy rule: no dash breaking a
 * sentence. A colon goes before what explains, a comma or a new sentence
 * otherwise. Read from source, since most messages need a whole trip to fire.
 * Comment lines are left out: the rule is for what a person reads on Checks.
 */
const RULES = path.dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(RULES).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

describe("the checks' messages", () => {
  it.each(sources)("break no sentence with a dash: %s", (file) => {
    const shown = readFileSync(path.join(RULES, file), "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\/?\*)/.test(line));

    expect(shown.filter((line) => line.includes(" — "))).toEqual([]);
  });
});
