import { useState } from "react"
import { cn } from "cn"
import { initials } from "@/lib/format"

/** Store product image, or initials over faint WG stripes when there is none. */
export function CoverArt({ src, title, className }: { src: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (src && !failed)
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("size-full object-cover", className)}
      />
    )
  return (
    <div className={cn("stripes grid size-full place-items-center bg-surface", className)}>
      <span className="font-display text-5xl text-white/30">{initials(title)}</span>
    </div>
  )
}
