/**
 * The card grid: 2 columns on a phone, up to 7 on a wide screen. The same steps as
 * GRID_COLUMNS (hooks/use-grid-columns.ts); GameCard's image sizes follow them too.
 */
export function GameGrid({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 ${className}`}>{children}</div>
}
