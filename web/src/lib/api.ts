import type { HealthResponse } from "@ugs/shared"

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`)
  return res.json() as Promise<T>
}

export const api = {
  health: () => get<HealthResponse>("/api/health"),
}
