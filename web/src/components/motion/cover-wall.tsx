import { m, useTransform, type MotionValue } from "motion/react"
import { cn } from "cn"
import { ease } from "@/lib/motion"

const COLUMNS = 7 // phones show the first 4
const PER_LOOP = 8 // tiles in one loop of a column; tall enough to cover a 140vh wall

/**
 * Loading-screen backdrop: a tilted wall of real covers (INK's tilted art) in columns
 * drifting opposite ways (WG's rows sliding in turn, stood upright). Each cover wipes
 * in the moment its image has loaded, so the wall assembles as the art arrives, and
 * the whole wall gains colour as `progress` (0–100) climbs.
 */
export function CoverWall({
  images,
  loaded,
  progress,
  shiftX,
  shiftY,
}: {
  images: readonly string[]
  loaded: ReadonlySet<string>
  progress: MotionValue<number>
  shiftX: MotionValue<number>
  shiftY: MotionValue<number>
}) {
  const filter = useTransform(progress, [0, 100], ["saturate(0.1) brightness(0.45)", "saturate(1) brightness(0.85)"])

  return (
    <m.div
      aria-hidden
      className="absolute top-1/2 left-1/2 flex h-[140vh] w-[max(120vw,65vh)] -translate-x-1/2 -translate-y-1/2 -rotate-[10deg] gap-2"
      style={{ filter, x: shiftX, y: shiftY }}
    >
      {Array.from({ length: COLUMNS }, (_, c) => (
        <div key={c} className={cn("min-w-0 flex-1", c >= 4 && "hidden md:block")}>
          {/* Two copies of the loop; sliding by -50% lands exactly on the second. */}
          <div
            className="wall-drift flex flex-col"
            style={{
              animationDuration: `${46 + (c % 3) * 12}s`,
              animationDirection: c % 2 ? "reverse" : "normal",
              animationDelay: `${-c * 6}s`,
            }}
          >
            {[0, 1].map((copy) => (
              <div key={copy} className="flex flex-col gap-2 pb-2">
                {Array.from({ length: PER_LOOP }, (_, k) => {
                  const src = images.length ? images[(k * COLUMNS + c) % images.length]! : null
                  return <Tile key={k} src={src && loaded.has(src) ? src : null} delay={((k + c) % 6) * 0.06} />
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </m.div>
  )
}

function Tile({ src, delay }: { src: string | null; delay: number }) {
  return (
    <div className="stripes relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface">
      {src && (
        <m.img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
          initial={{ clipPath: "inset(100% 0% 0% 0%)", scale: 1.25 }}
          animate={{ clipPath: "inset(0% 0% 0% 0%)", scale: 1 }}
          transition={{ duration: 1, ease: ease.wg, delay }}
        />
      )}
    </div>
  )
}
