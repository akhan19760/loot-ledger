import { cn } from "cn"

/**
 * INK button label: on hover (of the nearest `group/roll`) the text rolls up and a
 * copy rolls in from below, with INK's overshooting ease over 0.5 s.
 */
export function RollText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // One line tall, so only one copy shows at a time.
    <span className={cn("relative inline-flex h-[1.15em] overflow-hidden leading-[1.15]", className)}>
      {/* self-start: without it flex stretches this column to the one-line height, and
          the -50% roll would move half a line instead of a full line. */}
      <span className="flex shrink-0 flex-col self-start transition-transform duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] group-hover/roll:-translate-y-1/2 group-focus-visible/roll:-translate-y-1/2 motion-reduce:transition-none">
        <span className="block">{children}</span>
        <span aria-hidden className="block">
          {children}
        </span>
      </span>
    </span>
  )
}
