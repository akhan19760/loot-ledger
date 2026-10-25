import { useId } from "react"
import { m } from "motion/react"
import { RollText } from "@/components/motion/roll-text"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/** The chip highlight glides between options (one shared layout per group), without a bounce. */
const pillSpring = { type: "spring", bounce: 0, duration: 0.6 } as const

/** Chips with one lime block gliding between them, like the filter bar's. Always one chosen. */
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
            <m.span
              layoutId={layoutId}
              transition={pillSpring}
              className="chamfer-sm absolute inset-0 -z-10 bg-primary"
            />
          )}
          <RollText>{text}</RollText>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
