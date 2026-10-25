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
  /** False shows nothing while the image loads (art floating on its own, like the hero's). */
  placeholder?: boolean
  className?: string
}

/**
 * Store product image, or initials over faint WG stripes when there is none. While the
 * image loads (some stores take seconds) faint initials hold its place, in the upper part a
 * card's text leaves clear, and the image fades in over them.
 */
export function CoverArt({ src, title, sizes, width, placeholder = true, className }: Props) {
  const url = src && thumb(src, width ?? 400)
  // Keyed by URL, so a new image (the dialog moving to another game) starts loading afresh.
  const [loaded, setLoaded] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  if (!url || failed === url)
    return (
      <div className={cn("stripes grid size-full place-items-center bg-surface", className)}>
        <span className="font-display text-5xl text-foreground/30">{initials(title)}</span>
      </div>
    )
  const ready = loaded === url
  return (
    <div className={cn("relative size-full", className)}>
      {!ready && placeholder && (
        <div aria-hidden className="absolute inset-0 bg-surface">
          <span className="absolute inset-x-0 top-0 grid h-1/2 place-items-center font-display text-5xl text-foreground/15">{initials(title)}</span>
        </div>
      )}
      <img
        // A cached image can be complete before React's load listener sees it
        ref={(img) => void (img?.complete && img.naturalWidth > 0 && setLoaded(url))}
        src={url}
        srcSet={width ? undefined : coverSrcSet(src)}
        sizes={width ? undefined : sizes}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(url)}
        onError={() => setFailed(url)}
        className={cn("relative size-full object-cover transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}
      />
    </div>
  )
}
