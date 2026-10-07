/**
 * WG's film-grain noise over the whole page (their #noise overlay), jittering like film.
 * 10% overscan is enough: the jitter moves it at most 3% of its size. (A bigger layer is
 * more for the compositor to blend over every frame, scrolling included.)
 */
export function Grain() {
  return <div aria-hidden className="grain pointer-events-none fixed -inset-[10%] z-[90] opacity-[0.05]" />
}
