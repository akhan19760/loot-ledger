/** WG's film-grain noise over the whole page (their #noise overlay), jittering like film. */
export function Grain() {
  return <div aria-hidden className="grain pointer-events-none fixed -inset-[50%] z-[90] opacity-[0.05]" />
}
