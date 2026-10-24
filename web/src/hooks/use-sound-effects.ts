import { useEffect, useRef } from "react"
import { play, unlockAudio, type Sound } from "@/lib/sfx"

/** What makes a sound when hovered or pressed. */
const INTERACTIVE = 'button:not(:disabled), a[href], [role="option"], [role="menuitem"]'
const SCROLL_NOTCH = 140 // px of scrolling per tick
const HOVER_GAP_MS = 60
const TICK_GAP_MS = 45
/** Hovers this soon after a scroll are things sliding under a still pointer: no sound. */
const SCROLL_QUIET_MS = 150

/**
 * The site's sound effects (lib/sfx.ts), from listeners on the document rather than on
 * each component: a tick on hovering something clickable, a press on clicking it (two
 * notes up or down when it switches something on or off), and a wheel-like tick while
 * scrolling with a mouse or trackpad. Dialogs whoosh through useDialogSound.
 */
export function useSoundEffects() {
  useEffect(() => {
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)")
    let hovered: Element | null = null
    let lastHover = 0
    let lastTick = 0
    let lastScroll = 0
    let lastY = window.scrollY
    let travelled = 0

    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      const el = (e.target as Element).closest?.(INTERACTIVE) ?? null
      if (el === hovered) return
      hovered = el
      const now = performance.now()
      if (!el || now - lastScroll < SCROLL_QUIET_MS || now - lastHover < HOVER_GAP_MS) return
      lastHover = now
      play("hover")
    }

    // Capture phase: the element's on/off state is read before React updates it.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element).closest?.(INTERACTIVE)
      if (el) play(soundFor(el))
    }

    const onScroll = () => {
      const now = performance.now()
      const dy = Math.abs(window.scrollY - lastY)
      lastY = window.scrollY
      lastScroll = now
      if (!finePointer.matches) return // touch scrolling stays quiet
      travelled += dy
      if (travelled < SCROLL_NOTCH) return
      travelled %= SCROLL_NOTCH
      if (now - lastTick < TICK_GAP_MS) return
      lastTick = now
      play("tick", dy / 60)
    }

    // A mouse press counts as a gesture on the way down, a touch only on the way up.
    window.addEventListener("pointerdown", unlockAudio, { capture: true })
    window.addEventListener("pointerup", unlockAudio, { capture: true })
    window.addEventListener("keydown", unlockAudio, { capture: true })
    document.addEventListener("pointerover", onOver, { passive: true })
    document.addEventListener("click", onClick, { capture: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("pointerdown", unlockAudio, { capture: true })
      window.removeEventListener("pointerup", unlockAudio, { capture: true })
      window.removeEventListener("keydown", unlockAudio, { capture: true })
      document.removeEventListener("pointerover", onOver)
      document.removeEventListener("click", onClick, { capture: true })
      window.removeEventListener("scroll", onScroll)
    }
  }, [])
}

// The dialogs open now, each reported by its own component, so following ?game doesn't
// take the whole page along. One whoosh as the first opens and one as the last closes:
// going from one dialog straight to another (a game to the cart) is silent, as one dialog.
const openDialogs = new Set<string>()
let heardOpen = false
let settle: ReturnType<typeof setTimeout> | undefined

/** A dialog's whoosh as it opens and closes (not for one open on arrival, from a link). */
export function useDialogSound(id: string, open: boolean) {
  const wasOpen = useRef(open)
  useEffect(() => {
    if (open) openDialogs.add(id)
    else openDialogs.delete(id)
    if (wasOpen.current === open) {
      heardOpen ||= open
      return
    }
    wasOpen.current = open
    // After the other changes made at the same time (one dialog closing as another opens).
    clearTimeout(settle)
    settle = setTimeout(() => {
      const now = openDialogs.size > 0
      if (now === heardOpen) return
      heardOpen = now
      play(now ? "open" : "close")
    })
  }, [id, open])
}

/** Options and switches turning on get two notes up; switches turning off, two down. */
function soundFor(el: Element): Sound {
  if (el.getAttribute("role") === "option") return "on"
  const state = el.getAttribute("aria-pressed") ?? el.getAttribute("data-state")
  if (state === "false" || state === "off") return "on"
  // A chosen chip clicked again stays chosen; a switch that's on turns off.
  if (state === "true" || state === "on") return el.closest('[data-slot="toggle-group"]') ? "click" : "off"
  return "click"
}
