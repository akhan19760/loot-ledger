import { describe, expect, it } from "vitest";
import { DIGITAL, detectCondition, detectKind, detectPlatform } from "./detect.ts";
import { buildLibrary } from "./build.ts";
import { broadGenres, buildGenreIndex, lookupGenres, type WikidataGames } from "./genres.ts";
import { pyRegex, stripChars } from "./pyregex.ts";
import { cleanTitle, gameKey } from "./titles.ts";
import cases from "./__fixtures__/python-cases.json" with { type: "json" };

// python-cases.json holds outputs of build.py's own functions for tricky inputs,
// generated while the Python scripts were still the reference implementation.

describe("titles (golden cases from build.py)", () => {
  it.each(cases.titles)("$raw", (c) => {
    const clean = cleanTitle(c.raw);
    expect(clean).toBe(c.clean);
    expect(gameKey(clean)).toBe(c.key);
    expect(detectPlatform(c.raw)).toBe(c.platform);
    expect(detectCondition(c.raw)).toBe(c.condition);
    expect(DIGITAL.test(c.raw)).toBe(c.digital);
  });
});

describe("variant beats title (golden cases from build.py)", () => {
  it.each(cases.variants)("$variant / $title", (c) => {
    expect(detectPlatform(c.variant, c.title)).toBe(c.platform);
    expect(detectCondition(c.variant, c.title)).toBe(c.condition);
    expect(DIGITAL.test(`${c.title} ${c.variant}`)).toBe(c.digital);
  });
});

describe("kind (golden cases from build.py)", () => {
  it.each(cases.kinds)("$title $meta", (c) => {
    expect(detectKind(c.title, c.meta)).toBe(c.kind);
  });
});

describe("genres (golden cases from build.py)", () => {
  it.each(cases.broadGenres)("$in", (c) => {
    expect(broadGenres(c.in)).toEqual(c.out);
  });

  const index = buildGenreIndex(cases.wikidata as WikidataGames);
  it("builds the same title index", () => {
    expect(Object.fromEntries(index)).toEqual(cases.genreIndex);
  });
  it.each(cases.lookups)("lookup $key", (c) => {
    expect(lookupGenres(c.key, index)).toEqual(c.genres);
  });
});

describe("generic PlayStation fallback (not in build.py)", () => {
  it("uses PlayStation when a listing names no specific console", () => {
    // Venture Games: title, variant and tags never say PS4/PS5
    expect(detectPlatform("New", "EA Sports FC 27", "Games | Games | PlayStation")).toBe("PlayStation");
  });
  it("never beats a specific console mentioned anywhere", () => {
    expect(detectPlatform("", "Spider-Man PlayStation Hits", "PS4 Games")).toBe("PS4");
    expect(detectPlatform("", "PlayStation 5 Console", "")).toBe("PS5");
  });
  it("still returns null with no hint at all", () => {
    expect(detectPlatform("", "Scrabble: Original Crossword Game", "")).toBeNull();
  });
  it("does not make a listing a game on its own", () => {
    expect(detectKind("PlayStation VR 2", [])).toBe("other");
    expect(detectKind("Random Thing PS5", [])).toBe("game");
  });
});

describe("Python regex compatibility", () => {
  it("treats accented letters as word characters for \\b", () => {
    expect(pyRegex(String.raw`\bmon\b`, "i").test("Pokémon")).toBe(false);
    expect(pyRegex(String.raw`\bmon\b`, "i").test("Poké mon")).toBe(true);
  });
  it("matches $ before a trailing newline", () => {
    expect("Days Gone new\n".replace(pyRegex(String.raw`\bnew\b$`, "gi"), "")).toBe("Days Gone \n");
  });
  it("is case-sensitive unless asked", () => {
    expect(pyRegex(String.raw`\s+for$`).test("It Takes Two FOR")).toBe(false);
    expect(pyRegex(String.raw`\s+for$`, "i").test("It Takes Two FOR")).toBe(true);
  });
  it("strips a character set from both ends like str.strip", () => {
    expect(stripChars(" -|Title: -", " -–—|/,:")).toBe("Title");
    expect(stripChars("---", "-")).toBe("");
  });
});

describe("Payload CMS adapter", () => {
  const store = { id: "ocean", name: "Ocean", platform: "payload" as const, base: "https://ocean.pk", linkStyle: null };
  const listings = (...products: object[]) =>
    buildLibrary({ stores: [store], feeds: new Map([[store.id, { fetchedAt: "", products }]]), wikidata: null }).games.flatMap((g) => g.listings);
  const game = { title: "Cuphead (PS5)", slug: "cuphead-ps5", platform: { name: "PlayStation" }, category: [{ name: "PS5 GAMES" }], compareAtPrice: null, stock: 3 };

  it("splits a new-and-used product into two offers", () => {
    const ls = listings({ ...game, condition: "both", price: 9500, usedPrice: 6500, usedCompareAtPrice: 7000 });
    expect(ls.map((l) => [l.condition, l.price, l.was, l.platform])).toEqual([
      ["used", 6500, 7000, "PS5"],
      ["new", 9500, null, "PS5"],
    ]);
    expect(ls[0]!.url).toBe("https://ocean.pk/products/cuphead-ps5");
  });

  it("uses price, not the stale usedPrice, on a used-only product", () => {
    expect(listings({ ...game, condition: "used", price: 5000, usedPrice: 4500 }).map((l) => [l.condition, l.price])).toEqual([["used", 5000]]);
  });

  it("gives each variant its own condition, falling back to the product's", () => {
    const variants = [
      { label: "Black", condition: "used", price: 13999, stock: 1 },
      { label: "White", condition: null, price: 22000, stock: 0 },
    ];
    const ls = listings({ ...game, title: "DualSense", condition: "both", price: 22000, variants });
    expect(ls.map((l) => [l.variant, l.condition, l.in_stock])).toEqual([
      ["Black / Used", "used", true],
      ["White", "new", false],
    ]);
  });
});
