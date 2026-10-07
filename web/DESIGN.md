# LootLedger design system

Every token, component style and animation below comes from one of two references:

- **WG** = [wondermakers.games](https://wondermakers.games/) (screenshots + its CSS/markup). This is the **base**: surfaces, buttons, fields, chips, the header bar.
- **INK** = [inkgames.com](https://inkgames.com/) (screenshots + its CSS). **Accents** only: the headline type, "■ LABEL" eyebrows, and image cards with the title over the art.

Both references are dark, so dark is the default theme. A light theme is available from the header toggle (remembered per browser); it is derived from the dark tokens rather than taken from a reference. The hero, the game cards and the loading screen stay dark in both themes (they carry the `dark` class), the same way the footer stays neon: they are panels over artwork, not page background.

## Fonts

The references use commercial fonts, so the app uses the closest free Google Fonts (self-hosted via Fontsource). Swap them in `src/index.css` (`--font-*`) if you license the originals.

| Role | Reference font | Used here |
|---|---|---|
| Body, UI (`font-sans`) | Codec Pro (WG) | Urbanist |
| Headlines (`font-display`), uppercase | Ruder Plakat LL (INK) | Anton |
| Eyebrow and small labels, uppercase | Codec Pro (WG header labels) | Urbanist, semibold, wider tracking |

No monospace font: INK's mono eyebrows were tried with JetBrains Mono and dropped because they looked generic. Labels use the body font, like WG's header labels ("● ONLINE", "61 FPS").

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
| `primary-ink` | `#d4fb08` | Neon used as a text or line colour (prices, eyebrows, outline chips, chosen selects). Same as `primary` in dark; see below |

### Light theme

White-alpha tokens become black-alpha, and neon stays the fill for buttons, chips and the footer. Neon text is unreadable on a light background, so anything that is neon *text* uses `primary-ink` instead of `primary`.

| Token | Light value |
|---|---|
| `background` / `foreground` | `#f1f1ec` / `#0b0b0b` |
| `popover` | `#fff` |
| `surface` / `card` | black 4% |
| `secondary` / `muted` / `accent` | black 6% |
| `muted-foreground` | black 60% |
| `border` / `input` | black 10% / black 20% |
| `primary-ink` | `#4a6400` (dark olive, 5.7:1 on the background) |
| `destructive` | `#d42600` |
| `neon-from` → `neon-to` | `#2f7a12` → `#7a6b00` |

For the few effects that can't be a token (the secondary button's gradient, the dialog's glass), the `light:` variant targets the page in light theme but not the always-dark panels.

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
| Scrollbars | Slim pill in the `input` colour on a clear track, `primary-ink` on hover; inset from rounded edges | — (matches WG chips/fields) |
| Dialog | At most 44rem tall; the body scrolls inside the rounded panel, the close button stays pinned | WG content block |
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
| Eyebrow | `■ LABEL`: small square + uppercase semibold body font | INK "■ INKGAMES", "■ PLAY" (square), WG header labels (type) |
| Headline | uppercase condensed display | INK "PLAY. WIN. EARN." |
| Image card | art fills the card, eyebrow + uppercase title over the bottom | INK "BUILD YOUR KINGDOM" cards |
| Compare grid (dialog) | "All offers / Compare" chips. Compare: highlight panels (neon value over a grey detail), then one panel per version (platform · condition · format) with a range bar on a scale shared by every version (neon dot = cheapest, hollow = out of stock) and one cell per store in the same order in every panel, so stores line up in columns and wrap on a phone. Cheapest cell has a neon edge; missing stores are dashed "Not listed" cells. The chosen view is remembered per browser | WG chips, WG panels, WG field underline (dashed variant) |
| Share | A secondary "Share" button beside the dialog's wishlist and cart buttons. On a phone it opens the share sheet; elsewhere it turns neon and "WhatsApp" and "Copy link" slide in beside it (tick and "Link copied" for 2 s). The link's preview (served by the API, not the app) is the cover, "Game: Rs 9,000 at Store" and the version, markdown and number of stores | WG chips and secondary buttons |
| Cart optimizer | Header: WG black circle with a bag and a neon count chip that pops on change. Dialog: "Delivering to" chips; one panel per game with its cover, the store and price the best plan picked, and version selects (neon when narrowed); the best plan in a neon-edged panel (total in the display face, neon), an order per store with neon price links, savings as outline chips; the single-store and each-cheapest alternatives as small panels | WG chips, WG selects, WG panels, INK headline type |
| Deals page | Its own path, `/deals`, reached from the header ("Deals", neon while on it) and the hero. Headline and eyebrows like the library, jump chips for its three lists, the library's Platform and Condition chips in a panel. Each list is a section with an INK headline ("Marked down.", "Shop around.", "Just in.") over the usual card grid, 12 cards then "Show more". Deal cards add a neon sticker in the display face, tilted slightly ("−69%", "Save Rs 9,499", "In stock"), the struck-through was price, and a one-line note in place of the badges | INK headline type, INK price-tag stickers, WG chips, WG panels |
| Wishlist and collection | Heart and tick in WG black circles at a card's top-left, shown on hover or focus (always on touch screens) and kept once on; wishlist = neon heart, owned = neon-filled circle with a black tick; the icon pops in with `ease.inkRoll`. The dialog has the same two as labelled buttons (secondary, neon when on). "Show: All games / Wishlist · n / Collection · n" chips top the filter bar; a list view gets a summary panel of big display figures (count, in stock, cost today in neon), notes for games the filters hide or no store lists, and backup export/import | WG round icon, WG chips, INK headline type |

## Motion

Built with [motion](https://motion.dev) (React) and [Lenis](https://lenis.darkroom.engineering/) smooth scrolling. Everything honours the OS "reduce motion" setting: motion goes instant, Lenis, the grain, stripes, equalizer and loading sweep stop, and the loading screen is skipped.

Keeping it smooth while scrolling:

- Lenis is stepped from motion's frame loop, so scroll-linked effects read the scroll position the page is drawn at (two loops drift a frame apart: jitter).
- Scroll-in animations (sections, headlines, cards) animate `transform`, `opacity` and `clipPath`, which the browser runs off the main thread, rather than motion's `x`, `y` and `scale`, which run in JavaScript every frame. Anything moved from JavaScript by scroll or the pointer has `will-change`, so moving it doesn't repaint it.
- Components use the slim `m.*` elements; `LazyMotion` (main.tsx) loads their features after the first render. The loading screen, a lazy chunk of its own, keeps the full `motion.*` elements from `motion/react-client`.
- The library grid is virtualized: only the rows near the viewport are in the DOM.
- While a wheel or trackpad scrolls the page fast, game cards ignore the pointer, so the ones sliding under it don't start their hover effects (not after touch or keyboard scrolling, which would swallow taps).

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
| Whole page | Film grain, jittering | WG `#noise` overlay |
| Whole page | Inertial smooth scrolling | Lenis (the one addition not taken from the references) |
| Header | Slides in after the loading screen, hides on scroll down, returns on scroll up, turns more opaque once scrolled; stats count up | WG floating header + WG live FPS counter |
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
| Grid | Virtualized; when filters change, cards that stay glide to their new place | — (CSS transition on each card's position) |
| Dialog | Grows out of the clicked card: a panel carrying the card's cover flies to the dialog's box while the cover fades, then hands over to the dialog; closing flies back into the card. Opened from a link (no card on screen), it rises and scales in with `ease.wg`. Then the title reveals by word; cover wipes in tilted; offers cascade; cheapest offer's edge pulses neon; close icon spins | Material container transform, WG blocks, INK reveals, WG glow keyframes, WG spinToClose |
| Header | Theme toggle: black circle, sun/moon roll through it; the new theme spreads in a circle from the button (View Transitions) | WG round icon + INK roll |
| Footer | Neon hazard stripes slide endlessly; giant white wordmark on neon rises as you reach the end | WG `#yellow-stripe-wrapper` + "Let's join forces" |
| Loading | Skeletons with a sweeping light band (`sweep`) | — |

### Loading screen (`src/components/loading-screen.tsx`)

A video-game loading screen on a first visit to the home page: shown at most once a week per browser, never on a link to something in particular (a shared game, /deals, a wishlist), and skipped with reduced motion. Nothing on it is faked: each boot-log step resolves only when that part of the page has loaded. Steps are paced about 0.15 s apart so a fast load still reads as a sequence, the screen never holds the page for more than 3.5 s, and a tap, click or Esc skips it at any time. The loading-screen idea came from the brief ("like a video game loading screen"); the parts marked *new* have no counterpart in the references.

| Part | Effect | Source |
|---|---|---|
| Backdrop | Real covers on a tilted wall, columns drifting opposite ways, leaning away from the pointer. Each cover wipes in once its image has loaded, and the wall gains colour as loading progresses | INK tilted art + clip-path; WG sliding word rows, turned upright |
| Top bar | Same bar as the header: live equalizer, "● Online" / "Connecting", live FPS, last update | WG header stats and FPS counter |
| Percentage | Huge odometer: each wheel clicks over digit by digit, leading zeros dim, neon glow at 100 | INK headline type; odometer *new* |
| Boot log | Fonts, ledger, stores, library, cover art with their real results. The running step pulses; stores check in as chips turning neon | WG panel, chips and live dot; boot log *new* |
| Bar | 40 blocks light one at a time with a glow at the edge; the whole bar glows when done; real load time beside it | WG loading bar; blocks *new* |
| Tips | A random tip, then the next every 3.6 s or on "Next tip", sliding up | INK slide |
| Prompt | The favicon's LL tile flips like a coin inside a spinning ring. Then "Press any key" (or "Tap to continue"), with the ring counting down 0.7 s before it continues by itself. Esc, a tap or a click skips at any time | WG spin; prompt *new* |
| Exit | Wipes up over 1.2 s with the hazard stripes trailing; the HUD sinks as it goes and the page's entrance starts underneath | WG `#loader` wipe + WG hazard band |
