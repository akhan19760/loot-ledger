import { useEffect, useState } from "react"

/**
 * Download and decode images ahead of use. `loaded` fills in as each one is ready;
 * `settled` also counts images that failed, so callers know when to stop waiting.
 */
export function useImagePreload(urls: readonly string[]) {
  const [results, setResults] = useState<ReadonlyMap<string, boolean>>(() => new Map())
  const key = [...new Set(urls)].join("\n")

  useEffect(() => {
    if (!key) return
    let cancelled = false
    for (const url of key.split("\n")) {
      const img = new Image()
      img.referrerPolicy = "no-referrer" // same as <CoverArt>, so the cached copy is reused
      img.src = url
      img.decode().then(
        () => !cancelled && setResults((m) => new Map(m).set(url, true)),
        () => !cancelled && setResults((m) => new Map(m).set(url, false)),
      )
    }
    return () => {
      cancelled = true
    }
  }, [key])

  const unique = key ? key.split("\n") : []
  const loaded = new Set(unique.filter((u) => results.get(u) === true))
  return { loaded, settled: unique.filter((u) => results.has(u)).length, total: unique.length }
}
