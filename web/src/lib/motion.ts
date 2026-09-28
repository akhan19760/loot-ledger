// Motion tokens, lifted from the reference sites' own CSS (see DESIGN.md → Motion).

type Bezier = [number, number, number, number]

export const ease = {
  /** WG's signature ease-out for panels and reveals. */
  wg: [0.3, 0, 0.04, 1] as Bezier,
  /** WG page loader wipe (1.5 s). */
  wgWipe: [0.77, 0, 0.175, 1] as Bezier,
  /** WG height / layout changes. */
  wgInOut: [0.645, 0.045, 0.355, 1] as Bezier,
  /** INK button roll: slight overshoot. */
  inkRoll: [0.175, 0.885, 0.32, 1.275] as Bezier,
  /** INK text slide-up reveal (0.8 s). */
  inkSlide: [0.835, 0.12, 0.225, 0.77] as Bezier,
  /** INK fade-in. */
  inkFade: [0.2, 0.715, 0.205, 0.99] as Bezier,
}

export const css = (b: Bezier) => `cubic-bezier(${b.join(",")})`

/** Spring used for pointer-driven motion (card tilt, magnet); settles like WG's .6 s transforms. */
export const pointerSpring = { stiffness: 220, damping: 22, mass: 0.6 }
