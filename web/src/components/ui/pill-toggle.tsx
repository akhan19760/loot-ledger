import { useId } from "react"
import { motion } from "motion/react"
import { RollText } from "@/components/motion/roll-text"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/** The chip highlight glides between options (one shared layout per group). */
const pillSpring = { type: "spring", bounce: 0.22, duration: 0.55 } as const

/** WG chips with one neon pill gliding between them, like the filter bar's. Always one chosen. */
export function PillToggle<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (value: T) => void
  className?: string
}) {
  const layoutId = useId()
  return (
    <ToggleGroup
      type="single"
      size="sm"
      aria-label={label}
      value={value}
      // Radix reports "" when the pressed chip is clicked again: keep the current value.
      onValueChange={(v) => v && onChange(v as T)}
      className={className}
    >
      {options.map(([v, text]) => (
        <ToggleGroupItem
          key={v}
          value={v}
          className="group/roll relative isolate active:scale-95 data-[state=on]:bg-transparent data-[state=on]:hover:bg-transparent"
        >
          {value === v && (
            <motion.span
              layoutId={layoutId}
              transition={pillSpring}
              className="absolute inset-0 -z-10 rounded-2xl bg-primary shadow-[0_0_22px_-4px_rgb(212_251_8/0.6)]"
            />
          )}
          <RollText>{text}</RollText>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
