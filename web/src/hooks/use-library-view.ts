import { useSyncExternalStore } from "react"

/** How the library lays its games out: spines on a shelf, or covers in a grid. */
export type LibraryView = "shelf" | "grid"

const KEY = "lootledger-view"
const EVENT = "library-view-change"

// Until someone picks: the shelf where there's a mouse to pull spines out with, the grid on
// touch screens, where thin spines are harder to aim at than covers.
const fallback = (): LibraryView => (matchMedia("(hover: hover) and (pointer: fine)").matches ? "shelf" : "grid")

// A choice made where storage is blocked still holds until the page is closed.
let chosen: LibraryView | null = null

function read(): LibraryView {
  if (chosen) return chosen
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === "shelf" || saved === "grid") return saved
  } catch {
    // Storage blocked: the default for this screen.
  }
  return fallback()
}

const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange)
  window.addEventListener("storage", onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener("storage", onChange)
  }
}

/** The library's layout, remembered per browser. */
export function useLibraryView() {
  const view = useSyncExternalStore(subscribe, read)
  const setView = (next: LibraryView) => {
    chosen = next
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // Storage blocked: the choice lasts for this page.
    }
    window.dispatchEvent(new Event(EVENT))
  }
  return [view, setView] as const
}
