# LootLedger design system

Every token, component style and animation below comes from one of two references:

- **WG** = [wondermakers.games](https://wondermakers.games/) (screenshots + its CSS/markup). This is the **base**: surfaces, buttons, fields, chips, the header bar.
- **INK** = [inkgames.com](https://inkgames.com/) (screenshots + its CSS). **Accents** only: the headline type, mono "■ LABEL" eyebrows, and image cards with the title over the art.

Dark theme only; both references are dark. The one light WG section was not used.

## Fonts

The references use commercial fonts, so the app uses the closest free Google Fonts (self-hosted via Fontsource). Swap them in `src/index.css` (`--font-*`) if you license the originals.

| Role | Reference font | Used here |
|---|---|---|
| Body, UI (`font-sans`) | Codec Pro (WG) | Urbanist |
| Headlines (`font-display`), uppercase | Ruder Plakat LL (INK) | Anton |
| Eyebrow labels (`font-mono`), uppercase | PP Neue Montreal Mono (INK) | JetBrains Mono |

## Colors

| Token | Value | Source |
|---|---|---|
| `background` | `#000` | WG page background |
| `foreground` | `#fff` | WG text |
| `muted-foreground` | white 70% | WG placeholders `md:placeholder:text-white/70`, `#ffffffb3` |
| `primary` | `#d4fb08` | WG `neon-400` (buttons, chips, highlights) |
| `primary-hover` | `#bae200` | WG `hover:bg-neon-500` |
| `primary-foreground` | `#253300` | WG `text-neon-950` on neon buttons |
| `secondary` / `muted` / `accent` | white 10% | WG chips `bg-white/10` |
| `surface` | white 5% | WG `#ffffff0d` |
| `border` | white 10% | WG field underline `border-white/10` |
| `input` | white 20% | WG select `border-white/20` |
| `destructive` | `#ff2e00` | WG `text-invalid` / `border-invalid` |
| `popover` | `#252525` | WG gradient stop `#252525` |
| `neon-from` → `neon-to` | `#abf62c` → `#f6fd02` | WG gradient hero words, sampled from the screenshot; used as `text-neon` / `text-neon-reverse` |

## Shape, spacing, effects

| | Value | Source |
|---|---|---|
| Radius | 16px (`rounded-2xl`) for panels, buttons, fields, chips | WG `--radius: 16px`, `rounded-[16px]`, `rounded-2xl` |
| Small radius | 10px | WG secondary ("Contact") button `rounded-[10px]` |
| Panel gap | 8px | WG `--gap: 8px` |
| Header bar | 80px (56px on mobile), floating 8px from the edges, blurred | WG `--h-controller: 80px / 56px`, `backdrop-blur` |
| Panel blur | 37.5px | WG `backdrop-blur-[37.5px]` on content blocks |
| Overlay | black 50% + 8px blur | WG `#00000080`, `blur(8px)` |
| Glow | `drop-shadow(0 0 15px #d4fb08)` | WG neon drop-shadows |
| Stripes | 45° neon stripes | WG hazard-stripe panels |

## Components

| Component | Look | Source |
|---|---|---|
| Button, primary | neon fill, `#253300` text, 42px high, 24px side padding, 16px radius, darker neon on hover | WG "Learn more" / "Play demo" |
| Button, secondary | black→neutral-700 30% gradient, white text, 10px radius, lifts 1px on hover | WG "Contact" |
| Button, ghost | plain white text | WG nav links "Our work", "Services" |
| Round icon button | 48px black circle | WG play-icon circle, close control |
| Arrow on outbound links `↗` | after the label | INK "SIGN UP ↗", "EXPLORE ↗" |
| Chip / toggle | white 10% fill, white text, 16px radius, `text-sm leading-none`; selected = neon fill, dark text | WG tag chips (both variants) |
| Text field | transparent, underline `white/10`, large text with -1px tracking, white/70 placeholder turning white on focus | WG contact form inputs |
| Select | transparent, `white/20` border, 16px radius; white border on focus; neon border + text when a value is chosen | WG contact form selects |
| Panel | white 5% fill (or neutral-700 20% + blur on overlays), 16px radius | WG content blocks |
| Status stat | small neon value over an uppercase grey label, optional dot | WG header "● ONLINE", "61 FPS" |
| Eyebrow | `■ LABEL`: small square + uppercase mono | INK "■ INKGAMES", "■ PLAY" |
| Headline | uppercase condensed display | INK "PLAY. WIN. EARN." |
| Image card | art fills the card, eyebrow + uppercase title over the bottom | INK "BUILD YOUR KINGDOM" cards |

## Motion

Built with [motion](https://motion.dev) (React) and [Lenis](https://lenis.darkroom.engineering/) smooth scrolling. Everything honours the OS "reduce motion" setting: motion goes instant, Lenis, the grain, stripes, equalizer and shimmer stop, and the intro is skipped.

### Easing (`src/lib/motion.ts`)

| Token | Curve | Source |
|---|---|---|
| `ease.wg` | `cubic-bezier(.3,0,.04,1)` | WG's panel/reveal transitions |
| `ease.wgWipe` | `cubic-bezier(.77,0,.175,1)` | WG page loader in/out (1.5 s) |
| `ease.wgInOut` | `cubic-bezier(.645,.045,.355,1)` | WG height/transform changes |
| `ease.inkRoll` | `cubic-bezier(.175,.885,.32,1.275)` | INK button label roll (0.5 s) |
| `ease.inkSlide` | `cubic-bezier(.835,.12,.225,.77)` | INK text slide-up reveal (0.8 s) |
| `ease.inkFade` | `cubic-bezier(.2,.715,.205,.99)` | INK fade-in |

### Effects

| Where | Effect | Source |
|---|---|---|
| First visit | Neon full-screen intro: wordmark letters slide up, loading bar fills to 90 % while data loads, then the panel wipes up | WG `#loader` (translateY wipe, loading bar 0 → 90 %) + INK split-text |
| Whole page | Film grain, jittering | WG `#noise` overlay |
| Whole page | Inertial smooth scrolling | Lenis (the one addition not taken from the references) |
| Header | Slides in after the intro, hides on scroll down, returns on scroll up, turns more opaque once scrolled; stats count up | WG floating header + WG live FPS counter |
| Header | Round black badge with bouncing neon bars (API live) | WG audio control |
| Hero | Wordmark letters slide up from a mask; "Ledger" in the neon gradient | INK split-text + WG gradient words |
| Hero | Real game covers, tilted, around the headline; clip-path reveal; drift with scroll and pointer; straighten on hover | INK tilted art around its headline + INK clip-path |
| Hero | Neon light that follows the pointer | WG `#star-glow-element` (blurred neon) |
| Hero | Two rows of huge words, white/neon alternating, sliding opposite ways on scroll | WG "Animation Website / 3D Game UX/UI Web3" rows |
| Hero | Headline shrinks, blurs and fades as you scroll past | WG block transitions |
| Sections | Rise 80px and fade in as they enter | WG blocks start `translate-y-[5rem]` |
| Buttons | Label rolls up, copy rolls in from below | INK `ButtonInnerMain` translateY(-100%) |
| Buttons | Neon glow on hover, press-in on click | WG neon drop-shadows |
| Big buttons | Black circle icon spins to 330° on hover | WG `#big-button #icon` fastSpin |
| Chips | One neon pill glides between options (spring); labels roll | WG neon chip + INK roll |
| Search | Neon underline draws in from the left on focus; example text rolls to the next every 2.6 s; clear button spins in | WG field + INK slide |
| Selects | Chevron flips, chosen select glows, options cascade in | WG select states + INK stagger |
| Cards | Scroll-in stagger; cover wipes in (clip-path) and zooms; 3D tilt toward the pointer with a neon glare; neon glow + border; arrow circle spins in; "View N offers" rises | INK cards, clip-path, tilt; WG glow |
| Grid | When filters change, cards that stay glide to their new place | — (layout animation) |
| Dialog | Rises and scales in with `ease.wg`; title reveals by word; cover wipes in tilted; offers cascade; cheapest offer's edge pulses neon; close icon spins | WG blocks, INK reveals, WG glow keyframes, WG spinToClose |
| Footer | Neon hazard stripes slide endlessly; giant white wordmark on neon rises as you reach the end | WG `#yellow-stripe-wrapper` + "Let's join forces" |
| Loading | Skeletons with a sweeping shimmer | — |
