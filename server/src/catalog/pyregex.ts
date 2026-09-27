/**
 * Compile a Python `re` pattern (str) into a JS RegExp that behaves the same on
 * store titles. Pass "i" in flags for re.IGNORECASE, "g" for use with replace().
 * The rules were written and tuned in Python, where a few things differ from JS:
 *
 * - `\b` and `\d` are Unicode-aware in Python ("Pokémon" has no boundary inside
 *   "émon"); JS `\b` only knows [A-Za-z0-9_]. `\b` becomes explicit lookarounds
 *   over Unicode letters/numbers and `\d` becomes `\p{Nd}`.
 * - Python's `$` also matches just before a trailing newline.
 * - re.I uses Unicode case folding: the `u` flag makes JS `i` do the same.
 */
const WORD = String.raw`[\p{L}\p{N}_]`;
const BOUNDARY = `(?:(?<=${WORD})(?!${WORD})|(?<!${WORD})(?=${WORD}))`;

export function pyRegex(pattern: string, flags = ""): RegExp {
  let out = "";
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]!;
    if (c === "\\") {
      const next = pattern[++i]!;
      if (next === "b" && !inClass) out += BOUNDARY;
      else if (next === "d") out += String.raw`\p{Nd}`;
      else out += c + next;
    } else if (inClass) {
      if (c === "]") inClass = false;
      out += c;
    } else if (c === "[") {
      inClass = true;
      out += c;
    } else if (c === "$") {
      out += String.raw`(?=\n?$)`;
    } else {
      out += c;
    }
  }
  return new RegExp(out, "u" + flags);
}

/** Python's str.strip(chars). */
export function stripChars(s: string, chars: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && chars.includes(s[start]!)) start++;
  while (end > start && chars.includes(s[end - 1]!)) end--;
  return s.slice(start, end);
}

/** Python's len(): code points, not UTF-16 units. */
export const pyLen = (s: string) => [...s].length;

/** Python's default string ordering: by code point. */
export function pyCompare(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = x[i]!.codePointAt(0)! - y[i]!.codePointAt(0)!;
    if (d) return d;
  }
  return x.length - y.length;
}
