import type { Store } from "@ugs/shared"
import { Eyebrow } from "@/components/ui/eyebrow"

export function SiteFooter({ stores }: { stores: Store[] }) {
  return (
    <footer className="mt-2 grid gap-4 rounded-2xl bg-surface p-6 md:p-8">
      <Eyebrow className="text-muted-foreground">Stores</Eyebrow>
      <ul className="flex flex-wrap gap-2">
        {stores.map((s) => (
          <li key={s.id}>
            <a
              href={s.base}
              target="_blank"
              rel="noopener"
              className="inline-flex h-9 items-center rounded-2xl bg-secondary px-4 text-sm leading-none font-medium transition-colors hover:bg-white/20"
            >
              {s.name} ↗
            </a>
          </li>
        ))}
      </ul>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Prices are copied from each store's website and may have changed. The store's own page is the final word. Not affiliated with any of the
        listed stores.
      </p>
    </footer>
  )
}
