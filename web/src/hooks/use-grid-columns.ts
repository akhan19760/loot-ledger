import { useSyncExternalStore } from "react"

/**
 * Columns from each viewport width up, as in GameGrid's classes (sm, lg, xl, 2xl, 3xl).
 * VirtualGameGrid lays out from this table; GameCard's image sizes follow it too.
 */
export const GRID_COLUMNS = [
  [2200, 7],
  [1536, 6],
  [1280, 5],
  [1024, 4],
  [640, 3],
  [0, 2],
] as const

export const columnsAt = (viewport: number) => GRID_COLUMNS.find(([min]) => viewport >= min)![1]

const onResize = (change: () => void) => {
  window.addEventListener("resize", change)
  return () => window.removeEventListener("resize", change)
}

/** GameGrid's column count at the current width, e.g. to show whole rows. */
export function useGridColumns() {
  return useSyncExternalStore(onResize, () => columnsAt(window.innerWidth))
}
