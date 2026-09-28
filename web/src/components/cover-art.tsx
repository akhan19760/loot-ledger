import { useState } from "react"
import { cn } from "cn"
import { initials } from "@/lib/format"
import { coverSrcSet, thumb } from "@/lib/images"

interface Props {
  src: string | null
  title: string
  /** How wide the cover is drawn (the `sizes` attribute), so the browser picks a fitting copy. */
  sizes?: string
  /** A single copy this wide instead of letting the browser pick, e.g. to match a preloaded URL. */
  width?: number
  className?: string
}

/** Store product image, or initials over faint WG stripes when there is none. */
export function CoverArt({ src, title, sizes, width, className }: Props) {
  const [failed, setFailed] = useState(false)
  if (src && !failed)
    return (
      <img
        src={thumb(src, width ?? 400)}
        srcSet={width ? undefined : coverSrcSet(src)}
        sizes={width ? undefined : sizes}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className)}
      />
    )
  return (
    <div className={cn("stripes grid size-full place-items-center bg-surface", className)}>
      <span className="font-display text-5xl text-foreground/30">{initials(title)}</span>
    </div>
  )
}
