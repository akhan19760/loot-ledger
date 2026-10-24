import { useSyncExternalStore } from "react"

/** No mouse to hover with: a phone or tablet. The same query as the `touch:` variant (index.css). */
const TOUCH = "(hover: none), (pointer: coarse)"

const query = typeof window === "undefined" ? null : matchMedia(TOUCH)
const subscribe = (onChange: () => void) => {
  query?.addEventListener("change", onChange)
  return () => query?.removeEventListener("change", onChange)
}

/** Whether there's a mouse or trackpad (false on phones and tablets): the pointer-driven effects run only then. */
export function useFinePointer() {
  return useSyncExternalStore(subscribe, () => !(query?.matches ?? false))
}
