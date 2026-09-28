import { flushSync } from "react-dom"
import { useState } from "react"

export type Theme = "dark" | "light"

const KEY = "lootledger-theme" // also read by the inline script in index.html
const THEME_COLOR: Record<Theme, string> = { dark: "#000000", light: "#f1f1ec" }

const current = (): Theme => (document.documentElement.classList.contains("dark") ? "dark" : "light")

function apply(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark")
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme])
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
}

/** Dark by default; the choice is remembered. Switching spreads the new theme in a circle from `origin`. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(current)

  const toggle = (origin?: { x: number; y: number }) => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    const swap = () => {
      apply(next)
      flushSync(() => setTheme(next))
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduced || !origin) return swap()

    const radius = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
    document.startViewTransition(swap).ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${radius}px at ${origin.x}px ${origin.y}px)`] },
        { duration: 700, easing: "cubic-bezier(0.3, 0, 0.04, 1)", pseudoElement: "::view-transition-new(root)" },
      )
    })
  }

  return { theme, toggle }
}
