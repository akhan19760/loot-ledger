import type { FiltersResponse, Game, GamesLookup, GamesQuery, GamesResponse } from "@ugs/shared"

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { Accept: "application/json", ...init?.headers } })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

function gamesUrl(query: GamesQuery) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) params.set(key, String(value))
  return `/api/games?${params}`
}

export const api = {
  filters: () => request<FiltersResponse>("/api/filters"),
  games: (query: GamesQuery) => request<GamesResponse>(gamesUrl(query)),
  /** The same query, limited to the reader's wishlist or collection. */
  lookup: (query: GamesLookup) =>
    request<GamesResponse>("/api/games/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) }),
  game: (id: string) => request<Game>(`/api/games/${encodeURIComponent(id)}`),
}
