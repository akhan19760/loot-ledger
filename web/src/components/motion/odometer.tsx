import { motion, useTransform, type MotionValue } from "motion/react"
import { cn } from "cn"

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0] // trailing 0 so 9 → 0 rolls on, not back

// Each wheel rolls to its next digit during the last quarter of a unit, so it clicks
// over digit by digit and rests square on a digit whenever the value is whole.
const ROLL = 0.25

/**
 * Mechanical odometer for a motion value: each wheel rolls to its next digit as the
 * value nears it, and a higher wheel only turns while every wheel below it rolls
 * from 9 to 0. Leading zeros stay dim, like unlit display digits. Driven by a
 * MotionValue, so it never re-renders.
 */
export function Odometer({ value, places = 3, className }: { value: MotionValue<number>; places?: number; className?: string }) {
  return (
    <span className={cn("inline-flex leading-none tabular-nums", className)} aria-hidden>
      {Array.from({ length: places }, (_, i) => (
        <Wheel key={i} value={value} place={10 ** (places - 1 - i)} />
      ))}
    </span>
  )
}

function Wheel({ value, place }: { value: MotionValue<number>; place: number }) {
  // Position 0..10 on this wheel (10 is the trailing 0).
  const y = useTransform(value, (v) => {
    const below = v % place // what the lower wheels read
    const turning = Math.max(0, (below - (place - ROLL)) / ROLL)
    return `${-((Math.floor(v / place) % 10) + turning)}em`
  })
  const opacity = useTransform(value, [place - ROLL, place], [place === 1 ? 1 : 0.14, 1])

  return (
    <motion.span className="relative inline-block h-[1em] overflow-hidden" style={{ opacity }}>
      <motion.span className="flex flex-col" style={{ y }}>
        {DIGITS.map((d, i) => (
          <span key={i} className="block h-[1em]">
            {d}
          </span>
        ))}
      </motion.span>
    </motion.span>
  )
}
