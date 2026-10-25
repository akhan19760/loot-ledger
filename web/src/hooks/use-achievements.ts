/**
 * Achievements (DESIGN.md, "Achievements"): a handful of real moments, each unlocked once per
 * browser and announced with a toast (components/achievements.tsx).
 */
export const ACHIEVEMENTS = {
  "first-wish": { title: "First pick", body: "A game is on your wishlist. Its cheapest price is waiting there." },
  "first-owned": { title: "Collector", body: "Your first game is on the shelf as owned." },
  "window-shopper": { title: "Window shopper", body: "You've checked the prices of ten games." },
  "smart-cart": { title: "Shopped around", body: "Your cart's cheapest mix of shops saves {detail}." },
  "streak-5": { title: "Price sense", body: "Five right in a row in the bonus round." },
} as const

export type AchievementId = keyof typeof ACHIEVEMENTS

export interface Unlocked {
  id: AchievementId
  title: string
  body: string
}

const KEY = "lootledger-achievements"
const EVENT = "lootledger-achievement"
const OPENED_KEY = "lootledger-games-opened"

function unlockedIds(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>
  } catch {
    return {}
  }
}

// Unlocked this visit, for when storage is blocked: still only once.
const thisVisit = new Set<string>()

/** Unlock an achievement (once): saved, then announced. `detail` fills a {detail} in its text. */
export function unlock(id: AchievementId, detail = "") {
  const saved = unlockedIds()
  if (saved[id] || thisVisit.has(id)) return
  thisVisit.add(id)
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...saved, [id]: Date.now() }))
  } catch {
    // Storage blocked: unlocked for this visit only.
  }
  const a = ACHIEVEMENTS[id]
  window.dispatchEvent(new CustomEvent<Unlocked>(EVENT, { detail: { id, title: a.title, body: a.body.replace("{detail}", detail) } }))
}

/** Listen for unlocks (the toast host). */
export function onUnlock(listener: (a: Unlocked) => void) {
  const handler = (e: Event) => listener((e as CustomEvent<Unlocked>).detail)
  window.addEventListener(EVENT, handler)
  return () => window.removeEventListener(EVENT, handler)
}

/** Count a game whose prices were opened; the tenth unlocks "Window shopper". */
export function countGameOpened(id: string) {
  try {
    const seen = new Set(JSON.parse(localStorage.getItem(OPENED_KEY) ?? "[]") as string[])
    if (seen.has(id)) return
    seen.add(id)
    localStorage.setItem(OPENED_KEY, JSON.stringify([...seen].slice(-50)))
    if (seen.size >= 10) unlock("window-shopper")
  } catch {
    // Storage blocked: nothing counted.
  }
}
