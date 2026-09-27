// Title normalization: store title -> display title -> cross-store matching key.
import { decodeHTML } from "entities";
import { pyRegex, stripChars } from "./pyregex.ts";

/** Python's html.unescape. */
export const unescape = (s: string) => decodeHTML(s);

const STRIP = [
  String.raw`\(?\bused( game)?\b\)?`, String.raw`pre-?owned`, String.raw`\bbrand new\b`, String.raw`\(new\)`, String.raw`\bnew\b$`,
  String.raw`\b(usa|uk|eu|euro|asia|asian|arabic|middle east|japan|jp)\b( region| version)?`,
  String.raw`\b(us|me)\s+(region|version)\b|\(\s*(us|me)\s*\)|\br[0-9]\b|\bregion ?[0-9]\b`,
  String.raw`\bregion\b( free)?`, String.raw`\bversion\b`, String.raw`\bdisc\b|\bcd\b|\bphysical\b|\bdigital( code| game)?\b`,
  String.raw`\bfor\b(?=\s*(ps|playstation|nintendo|switch|xbox))`,
  String.raw`(\bps ?[345]|playstation ?[345]?|nintendo switch ?2?|\bswitch ?2?|\bpsp|xbox[a-z |/]*)\s+(video )?games?\b`,
  String.raw`\b(greatest hits|playstation hits|ps hits|nintendo selects|steelbook)\b`,
  String.raw`playstation ?®? ?[345]|\bps ?[345]\b|\bps ?vr ?2?\b|nintendo switch ?2?|\bswitch ?2?\b|\bnintendo\b`,
  String.raw`xbox series [xs](\s*[|/]\s*[xs])?|xbox one( [xs](\s*[|/]\s*[xs])?)?|\bxbox\b|\bpc\b`,
  String.raw`\b(standard|deluxe|gold|ultimate|launch|day ?(one|1)|premium|special|limited|collector'?s|` +
    String.raw`complete|digital deluxe|standard game)\s+(edition|ed\.?|version)\b`,
  String.raw`\bedition\b`,
].map((p) => pyRegex(p, "gi"));

// The rest of build.py's clean-up used re.sub without re.I.
const sub = (s: string, pattern: string, repl: string) => s.replace(pyRegex(pattern, "g"), repl);
const SEPARATORS = " -–—|/,:";

/** Display title without platform, region, condition and edition noise. */
export function cleanTitle(raw: string): string {
  let t = unescape(raw);
  t = sub(t, "[®™©]", "");
  for (const r of STRIP) t = t.replace(r, " ");
  t = sub(t, String.raw`\(\s*\)|\[\s*\]`, " ");
  t = sub(t.trim(), String.raw`\s*[-–—|/,:]+\s*$`, ""); // dangling separators
  t = sub(t, String.raw`^\s*[-–—|/,:]+\s*`, "");
  t = sub(t, String.raw`\s+[-–—|]+\s+[-–—|]+\s+`, " - ");
  t = stripChars(sub(t, String.raw`\s{2,}`, " ").trim(), SEPARATORS);
  t = sub(t, String.raw`\s+for$`, ""); // "Wreckreation for - PS5"
  return t || unescape(raw).trim();
}

const ROMAN: Record<string, string> = {
  ii: "2", iii: "3", iv: "4", v: "5", vi: "6", vii: "7", viii: "8", ix: "9", x: "10",
  xi: "11", xii: "12", xiii: "13", xiv: "14", xv: "15", xvi: "16",
};

/** Lowercase ASCII key used to match the same game across stores and Wikidata. */
export function gameKey(cleaned: string): string {
  let k = cleaned.normalize("NFKD").replace(/[^\x00-\x7f]/g, ""); // Ragnarök -> Ragnarok
  k = k.toLowerCase().replaceAll("&", " and ");
  k = k.replace(/['’`]/g, "");
  k = k.replace(/[^a-z0-9]+/g, " ");
  let words = k.split(" ").filter(Boolean).map((w) => ROMAN[w] ?? w);
  words = words.filter((w, i) => !(w === "part" && i + 1 < words.length && /^[0-9]+$/.test(words[i + 1]!)));
  if (words[0] === "the") words = words.slice(1);
  return words.join(" ");
}
