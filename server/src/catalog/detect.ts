// Classify a store listing: platform, condition, disc/digital and kind.
// Port of build.py; the patterns are unchanged Python regexes (see pyregex.ts).
import type { Condition, Kind } from "@ugs/shared";
import { pyRegex } from "./pyregex.ts";

const rx = (pattern: string) => pyRegex(pattern, "i");

// ---------------------------------------------------------------- platform

const PLATFORMS: [string, RegExp][] = [ // order matters: more specific first
  ["PS5", rx(String.raw`\bps ?5\b|playstation ?®? ?5|\bpsvr ?2\b|\bps vr2\b`)],
  ["PS4", rx(String.raw`\bps ?4\b|playstation ?®? ?4|\bps ?vr\b`)],
  ["PS3", rx(String.raw`\bps ?3\b|playstation ?3`)],
  ["Switch 2", rx(String.raw`\bswitch ?2\b`)],
  ["Switch", rx(String.raw`\bswitch\b|nintendo`)],
  ["Xbox Series", rx(String.raw`xbox series|\bseries [xs]\b|\bxsx\b`)],
  ["Xbox One", rx(String.raw`xbox ?one`)],
  ["Xbox", rx(String.raw`\bxbox\b`)],
  ["PC", rx(String.raw`\bpc\b|\bsteam\b`)],
];

/** First text that mentions a platform wins (variant > title > tags/categories). */
export function detectPlatform(...texts: string[]): string | null {
  for (const text of texts) {
    if (!text) continue;
    // earliest mention in that text; ties go to the more specific name (strict <)
    let bestName: string | null = null;
    let bestStart = Infinity;
    for (const [name, r] of PLATFORMS) {
      const m = r.exec(text);
      if (m && m.index < bestStart) [bestName, bestStart] = [name, m.index];
    }
    if (bestName) return bestName;
  }
  return null;
}

// ---------------------------------------------------------------- condition / format

const USED = rx(String.raw`\bused\b|pre-?owned|second ?hand|\brefurb`);
const NEW = rx(String.raw`\bnew\b|brand new|sealed`);
const NEW_ARRIVAL = rx(String.raw`new (arrival|games?)`);
export const DIGITAL = rx(String.raw`\bdigital\b|\b(primary|secondary)\b|\baccount\b|\b(digital|download|game|voucher) code\b`);

export function detectCondition(...texts: string[]): Condition {
  for (const text of texts) {
    if (!text) continue;
    if (USED.test(text)) return "used";
    if (NEW.test(text) && !NEW_ARRIVAL.test(text)) return "new";
  }
  return "new"; // stores list new stock unless they say otherwise
}

// ---------------------------------------------------------------- kind

const GIFTCARD = rx(
  String.raw`gift ?card|\bpsn\b|wallet|top.?up|\$ ?\d+|\d+ ?(usd|dollars?)\b|playstation plus|ps plus|` +
    String.raw`game ?pass|membership|subscription|eshop card|\bcredit\b|\bv-?bucks\b`,
);
// Strong: these words in a title mean hardware even if the store filed it under "Games".
const STRONG_HW = rx(
  String.raw`controller|dualsense|dualshock|joy-?con|gamepad|headset|headphone|earbud|earphone|speaker|` +
    String.raw`charg(er|ing)|\bdock\b|\bstand\b|cooling|cable|adapter|\bhdmi\b|keyboard|mouse ?pad|` +
    String.raw`monitor|\bchair\b|joystick|arcade stick|fight ?stick|racing wheel|steering|pedal|` +
    String.raw`\bssd\b|\bhdd\b|nvme|hard ?drive|memory card|\bsd card\b|\bskin\b|faceplate|cover plate|dust cover|` +
    String.raw`thumb ?grip|protector|tempered|carrying case|travel case|\bpouch\b|\bbag\b|` +
    String.raw`t-?shirt|hoodie|amiibo|funko|figurine|keychain|\bmug\b|poster|sticker|` +
    String.raw`\bconsole\b(?! edition)|\b(ps ?[45]|playstation ?[45]?|xbox)\b.{0,15}\b(slim|pro)\b|\b\d+ ?(gb|tb)\b|` +
    String.raw`oled|switch lite|steam deck|rog ally|legion go|playstation portal|\bvr ?2? headset\b|meta quest|oculus|` +
    String.raw`\bbattery|\bbatteries|\blaptop\b|\bsmart ?watch|\bpower ?bank|retro game|game stick`,
);
// Weak: only count when the store does not file the product under a games category
// (so "Mouse: P.I. For Hire" in "PS5 Games" stays a game).
const WEAK_HW = rx(
  String.raw`\bmouse\b|\bcase\b|\bcap\b|\bfigure\b|\bfan\b|\bcamera\b|\bremote\b|\bhandheld\b|` +
    String.raw`\bled\b|\brgb\b|\blamp\b|\bmat\b|\bgrip\b|\bwrap\b|\blight\b`,
);
const GAME_SIGNAL = rx(String.raw`\bgames?\b|video ?game`);
const NOT_GAME_SIGNAL = rx(String.raw`gift|card|accessor|console|controller|apparel|merch|hardware|gaming`);
const HW_META = rx(String.raw`accessor|console|controller|headset|chair|monitor|keyboard|mouse|apparel|merch`);

/** meta is the list of the store's own tags / categories / product type. */
export function detectKind(title: string, meta: string[]): Kind {
  const gameCat = meta.some((m) => GAME_SIGNAL.test(m) && !NOT_GAME_SIGNAL.test(m));
  if (GIFTCARD.test(title)) return "giftcard";
  if (STRONG_HW.test(title)) return "hardware";
  if (WEAK_HW.test(title) && !gameCat) return "hardware";
  if (gameCat) return "game";
  if (meta.some((m) => GIFTCARD.test(m))) return "giftcard";
  if (meta.some((m) => HW_META.test(m))) return "hardware";
  return detectPlatform(title) ? "game" : "other";
}
