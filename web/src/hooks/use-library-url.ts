import { useCallback, useSyncExternalStore } from "react"
import { PLATFORM_FILTERS, type GamesQuery, type SortOrder } from "@ugs/shared"
import type { ShelfList } from "@/hooks/use-shelf"

/**
 * Library state lives in the URL (?platform=PS5&q=elden&list=wishlist&game=game:elden-ring),
 * so any view is a shareable link and Back closes an open game. The last filters are also
 * remembered per browser, like the old page did.
 */
export type Filters = Omit<GamesQuery, "page" | "pageSize">

/** Which games the library shows: all of them, or the reader's wishlist or collection. */
export type LibraryList = "all" | ShelfList

export const DEFAULT_FILTERS: Filters = {
  q: "",
  genre: "",
  store: "",
  platform: "PS",
  condition: "",
  kind: "game",
  inStock: true,
  sort: "price",
}

const STORAGE_KEY = "gamelib-filters"
const URL_EVENT = "library-url-change"

const oneOf = <T extends string>(allowed: readonly T[], v: string | null): T | undefined =>
  v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : undefined

interface UrlState {
  filters: Filters
  list: LibraryList
  gameId: string | null
}

function parse(search: string): UrlState {
  const p = new URLSearchParams(search)
  const text = (key: string) => p.get(key) ?? undefined
  return {
    filters: {
      q: text("q") ?? DEFAULT_FILTERS.q,
      genre: text("genre") ?? DEFAULT_FILTERS.genre,
      store: text("store") ?? DEFAULT_FILTERS.store,
      platform: oneOf(["", ...PLATFORM_FILTERS], p.get("platform")) ?? DEFAULT_FILTERS.platform,
      condition: oneOf(["", "new", "used"] as const, p.get("condition")) ?? DEFAULT_FILTERS.condition,
      kind: oneOf(["", "game", "hardware", "giftcard", "other"] as const, p.get("kind")) ?? DEFAULT_FILTERS.kind,
      inStock: p.has("inStock") ? p.get("inStock") === "true" : DEFAULT_FILTERS.inStock,
      sort: oneOf<SortOrder>(["price", "spread", "stores", "az"], p.get("sort")) ?? DEFAULT_FILTERS.sort,
    },
    list: oneOf(["wishlist", "collection"] as const, p.get("list")) ?? "all",
    gameId: p.get("game"),
  }
}

/** Only values that differ from the defaults, to keep links short. */
function serialize({ filters, list, gameId }: UrlState): string {
  const p = new URLSearchParams()
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof Filters)[])
    if (filters[key] !== DEFAULT_FILTERS[key]) p.set(key, String(filters[key]))
  if (list !== "all") p.set("list", list)
  if (gameId) p.set("game", gameId)
  const s = p.toString()
  return s ? `?${s}` : location.pathname
}

function write(search: string, mode: "push" | "replace") {
  if (search === location.search || (search === location.pathname && !location.search)) return
  history[mode === "push" ? "pushState" : "replaceState"](null, "", search)
  window.dispatchEvent(new Event(URL_EVENT))
}

function remember(filters: Filters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...filters, q: "" }))
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

// First visit without filters in the URL: restore the last ones from this browser.
if (typeof window !== "undefined" && ![...new URLSearchParams(location.search).keys()].some((k) => k in DEFAULT_FILTERS)) {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Filters> | null
    if (saved) {
      const current = parse(location.search)
      const merged = parse(serialize({ ...current, filters: { ...current.filters, ...saved } })).filters // re-validated
      history.replaceState(null, "", serialize({ ...current, filters: merged }))
    }
  } catch {
    /* corrupt or blocked storage: keep defaults */
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange)
  window.addEventListener(URL_EVENT, onChange)
  return () => {
    window.removeEventListener("popstate", onChange)
    window.removeEventListener(URL_EVENT, onChange)
  }
}

let lastSearch: string | null = null
let lastParsed: UrlState
const snapshot = () => {
  if (location.search !== lastSearch) [lastSearch, lastParsed] = [location.search, parse(location.search)]
  return lastParsed
}

export function useLibraryUrl() {
  const { filters, list, gameId } = useSyncExternalStore(subscribe, snapshot)

  const setFilters = useCallback((patch: Partial<Filters>) => {
    const current = snapshot()
    const next = { ...current.filters, ...patch }
    remember(next)
    write(serialize({ ...current, filters: next }), "replace")
  }, [])

  const resetFilters = useCallback(() => {
    remember(DEFAULT_FILTERS)
    write(serialize({ ...snapshot(), filters: DEFAULT_FILTERS }), "replace")
  }, [])

  const setList = useCallback((next: LibraryList) => write(serialize({ ...snapshot(), list: next }), "replace"), [])

  /** Open a game (adds a history entry, so Back closes it) or close it (null). */
  const setGameId = useCallback((id: string | null) => {
    const current = snapshot()
    if (id === null) {
      // Opened from the grid: step back. Opened from a shared link: just drop ?game.
      if (history.state?.fromLibrary) history.back()
      else write(serialize({ ...current, gameId: null }), "replace")
      return
    }
    history.pushState({ fromLibrary: true }, "", serialize({ ...current, gameId: id }))
    window.dispatchEvent(new Event(URL_EVENT))
  }, [])

  return { filters, list, gameId, setFilters, resetFilters, setList, setGameId }
}
