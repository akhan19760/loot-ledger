import { byStockThenPrice } from "./filters.ts";
import type { Condition, Format, Listing } from "./types.ts";

/**
 * One version of a game: the same platform, condition and format. A used PS4 disc and
 * a new PS5 disc aren't the same product, so prices only compare within a version.
 */
export interface Version {
  key: string;
  platform: string | null;
  condition: Condition;
  format: Format;
  /** Every offer of this version, in stock first, then cheapest. */
  offers: Listing[];
  /** Each store's best offer for this version (in stock first, then cheapest), by store id. */
  byStore: Map<string, Listing>;
  /** The cheapest in-stock offer; null when none is in stock. */
  best: Listing | null;
  /** In-stock offers of this version. */
  inStock: number;
  /** Highest in-stock price among the stores' best offers; null when none is in stock. */
  high: number | null;
}

/** How platforms are ordered: newest console first, then the rest, then unknown. */
const PLATFORM_ORDER = ["PS5", "PS4", "PS3", "PlayStation", "Switch 2", "Switch", "Xbox Series", "Xbox One", "PC"];

const platformRank = (p: string | null) => {
  if (p === null) return PLATFORM_ORDER.length + 1;
  const i = PLATFORM_ORDER.indexOf(p);
  return i === -1 ? PLATFORM_ORDER.length : i;
};

export const versionKey = (l: Pick<Listing, "platform" | "condition" | "format">) => `${l.platform ?? ""}|${l.condition}|${l.format}`;

/** Group offers into versions: platform (newest first), then new before used, then disc before digital. */
export function groupVersions(listings: Listing[]): Version[] {
  const groups = new Map<string, Listing[]>();
  for (const l of listings) {
    const key = versionKey(l);
    groups.set(key, [...(groups.get(key) ?? []), l]);
  }

  const versions = [...groups].map(([key, group]): Version => {
    const offers = group.toSorted(byStockThenPrice);
    const byStore = new Map<string, Listing>();
    for (const l of offers) if (!byStore.has(l.store)) byStore.set(l.store, l);
    const storePrices = [...byStore.values()].filter((l) => l.in_stock).map((l) => l.price);
    const first = offers[0]!;
    return {
      key,
      platform: first.platform,
      condition: first.condition,
      format: first.format,
      offers,
      byStore,
      best: first.in_stock ? first : null,
      inStock: offers.filter((l) => l.in_stock).length,
      high: storePrices.length ? Math.max(...storePrices) : null,
    };
  });

  return versions.sort(
    (a, b) =>
      platformRank(a.platform) - platformRank(b.platform) ||
      (a.platform ?? "").localeCompare(b.platform ?? "") ||
      Number(a.condition === "used") - Number(b.condition === "used") ||
      Number(a.format === "digital") - Number(b.format === "digital"),
  );
}

/** Older consoles whose games mostly play on the newer one. */
const BACKWARD_COMPATIBLE: [older: string, newer: string][] = [
  ["PS4", "PS5"],
  ["Xbox One", "Xbox Series"],
  ["Switch", "Switch 2"],
];

export interface Insights {
  /** The cheapest in-stock offer of any version. */
  cheapest: { listing: Listing; version: Version } | null;
  /** The version with the biggest gap between the cheapest and priciest store. */
  storeGap: { version: Version; saving: number } | null;
  /** Buying used instead of new: same platform and format. */
  used: { newer: Version; used: Version; saving: number } | null;
  /** Buying the older console's copy: same condition and format. */
  olderPlatform: { older: Version; newer: Version; saving: number } | null;
}

/** The facts worth calling out about a game's versions. Each is null when it doesn't apply. */
export function versionInsights(versions: Version[]): Insights {
  const priced = versions.filter((v) => v.best);
  const find = (platform: string | null, condition: Condition, format: Format) =>
    priced.find((v) => v.platform === platform && v.condition === condition && v.format === format);

  const cheapestVersion = priced.reduce<Version | null>((min, v) => (!min || v.best!.price < min.best!.price ? v : min), null);

  let storeGap: Insights["storeGap"] = null;
  for (const v of priced) {
    const saving = v.high! - v.best!.price;
    if (saving > 0 && (!storeGap || saving > storeGap.saving)) storeGap = { version: v, saving };
  }

  // Versions are already in display order, so the first match is the most relevant one.
  let used: Insights["used"] = null;
  for (const v of priced) {
    if (v.condition !== "used") continue;
    const newer = find(v.platform, "new", v.format);
    if (newer && newer.best!.price > v.best!.price) {
      used = { newer, used: v, saving: newer.best!.price - v.best!.price };
      break;
    }
  }

  let olderPlatform: Insights["olderPlatform"] = null;
  for (const v of priced) {
    const pair = BACKWARD_COMPATIBLE.find(([, newer]) => newer === v.platform);
    const older = pair && find(pair[0], v.condition, v.format);
    if (older && v.best!.price > older.best!.price) {
      olderPlatform = { older, newer: v, saving: v.best!.price - older.best!.price };
      break;
    }
  }

  return {
    cheapest: cheapestVersion && { listing: cheapestVersion.best!, version: cheapestVersion },
    storeGap,
    used,
    olderPlatform,
  };
}
