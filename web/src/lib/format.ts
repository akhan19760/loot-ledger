const rupees = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 })

export const formatPrice = (n: number) => `Rs ${rupees.format(Math.round(n))}`

export const formatCount = (n: number) => rupees.format(n)

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

/** "3 hours ago", "yesterday", "just now". */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now
  for (const [unit, ms] of STEPS) if (Math.abs(diff) >= ms) return relative.format(Math.round(diff / ms), unit)
  return "just now"
}

/** Up to two initials, for games without cover art. */
export const initials = (title: string) =>
  title
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
