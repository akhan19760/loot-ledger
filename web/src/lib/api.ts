import type { FiltersResponse, Game, GamesQuery, GamesResponse } from "@ugs/shared"

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } })
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
  filters: () => get<FiltersResponse>("/api/filters"),
  games: (query: GamesQuery) => get<GamesResponse>(gamesUrl(query)),
  game: (id: string) => get<Game>(`/api/games/${encodeURIComponent(id)}`),
}
