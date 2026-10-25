# LootLedger design system

Every token, component style and animation below comes from one of two references:

- **WG** = [wondermakers.games](https://wondermakers.games/) (screenshots + its CSS/markup). This is the **base**: surfaces, buttons, fields, chips, the header bar.
- **INK** = [inkgames.com](https://inkgames.com/) (screenshots + its CSS). **Accents** only: the headline type and image cards with the title over the art.

Both references are dark, so dark is the default theme. A light theme is available from the header toggle (remembered per browser); it is derived from the dark tokens rather than taken from a reference. The hero, the game cards and the loading screen stay dark in both themes (they carry the `dark` class), the same way the footer stays neon: they are panels over artwork, not page background.

**Neon means something.** It marks prices, the one main action on a screen, selected states and the wordmark's "Ledger"; headlines are one colour. Surfaces are flat and separate by a step in tone, not by glass, glows or outlines: the only gradient on the page is the scrim under a card's text, and the only glow is the loading screen's START. Labels are sentence case at a readable size (13px and up) and never sit above a heading as an eyebrow.

## Fonts

The references use commercial fonts, so the app uses the closest free Google Fonts (self-hosted via Fontsource). Swap them in `src/index.css` (`--font-*`) if you license the originals.

| Role | Reference font | Used here |
|---|---|---|
| Body, UI (`font-sans`) | Codec Pro (WG) | Urbanist |
| Headlines (`font-display`), uppercase | Ruder Plakat LL (INK) | Anton |
| Small labels | Codec Pro (WG header labels) | Urbanist, medium, 13px, sentence case |

No monospace font: INK's mono eyebrows were tried with JetBrains Mono and dropped because they looked generic. Labels use the body font, like WG's header labels ("● Online", "61 FPS"). Figures are tabular everywhere (`tabular-nums` on `<html>`), so prices line up and counts keep their width as they change.

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
| `raised` | `#141414` | Opaque, one tone step off the page: the header once scrolled, dialogs, the drawer, a card's base. Replaces WG's glass |
| `border` | white 10% | WG field underline `border-white/10` |
| `input` | white 20% | WG select `border-white/20` |
| `destructive` | `#ff2e00` | WG `text-invalid` / `border-invalid` |
| `popover` | `#252525` | WG gradient stop `#252525` |
| `primary-ink` | `#d4fb08` | Neon used as a text or line colour (prices, "Ledger" via `text-neon`, chosen selects, the cheapest offer's edge). Same as `primary` in dark; black in light, see below |

### Light theme

White-alpha tokens become black-alpha. Neon is hard on the eye on a light background, both as text and as a fill, so on the page (not the always-dark panels):

- Neon *text* (`primary-ink`, `text-neon`) is plain black.
- Primary buttons and chosen chips are black with neon text; the round icon on a primary button turns neon with a black icon.
- A chosen select has a 2px black border; the cheapest offer's edge is black. Pale neon tints (outline badges, cart savings) are stronger, so they still read on white.
- The footer stays neon, with a black wordmark (as in dark).

| Token | Light value |
|---|---|
| `background` / `foreground` | `#f1f1ec` / `#0b0b0b` |
| `popover` | `#fff` |
| `surface` / `card` | black 4% |
| `raised` | `#fff` |
| `secondary` / `muted` / `accent` | black 6% |
| `muted-foreground` | black 60% |
| `border` / `input` | black 10% / black 20% |
| `primary-ink` | `#0b0b0b` (same as `foreground`) |
| `destructive` | `#d42600` |

For the few things that can't be a token (the chosen chip's fill, the search field's fill, the neon tints), the `light:` variant targets the page in light theme but not the always-dark panels.

## Shape, spacing, effects

| | Value | Source |
|---|---|---|
| Radius | 16px (`rounded-2xl`) for panels, buttons, fields, chips | WG `--radius: 16px`, `rounded-[16px]`, `rounded-2xl` |
| Small radius | 10px | WG secondary ("Contact") button `rounded-[10px]` |
| Panel gap | 8px | WG `--gap: 8px` |
| Header bar | 80px (56px on mobile), floating 8px from the edges; clear over the top of the page, an opaque `raised` bar once scrolled (no blur) | WG `--h-controller: 80px / 56px` |
| Overlay | black 70% (40% in light), no blur | WG `#00000080`, deepened in place of its `blur(8px)` |
| Glow | `drop-shadow(0 0 15px #d4fb08)`, on the loading screen's START button only | WG neon drop-shadows |
| Scrollbars | Slim pill in the `input` colour on a clear track, `primary-ink` on hover; inset from rounded edges | — (matches WG chips/fields) |
| Dialog | At most 44rem tall; the body scrolls inside the rounded panel, the close button stays pinned | WG content block |
| Drawer | Phones: the dialog's opaque panel docked to the bottom edge, top corners rounded, at most 88% of the screen tall; grab handle, display-type title and close button on top, the body scrolls, actions pinned along the bottom. Rises with `ease.wg`, drops away quicker | WG content block; bottom sheet *new* |
| Stripes | 45° neon stripes | WG hazard-stripe panels |

## Components

| Component | Look | Source |
|---|---|---|
| Button, primary | neon fill, `#253300` text, 42px high, 24px side padding, 16px radius, darker neon on hover. Light theme: black fill, neon text | WG "Learn more" / "Play demo" |
| Button, secondary | flat `secondary` fill (white 10%), white text, 10px radius; lifts 1px and steps lighter on hover | WG "Contact" |
| Button, ghost | plain white text | WG nav links "Our work", "Services" |
| Round icon button | 48px black circle | WG play-icon circle, close control |
| Arrow on outbound links `↗` | after the label | INK "SIGN UP ↗", "EXPLORE ↗" |
| Chip / toggle | white 10% fill, white text, 16px radius, `text-sm leading-none`; selected = neon fill, dark text (light theme: black fill, neon text) | WG tag chips (both variants) |
| Search field | 48px (56px from md) rounded box, white 5% fill, `border` outline, magnifier on the left; the border turns neon on focus (black in light theme). The hero's is larger (56px, 64px from md) with a neon "Find prices" button at its end (an arrow on phones) | — (rounded field, chosen over WG's underline input) |
| Select | transparent, `white/20` border, 16px radius; white border on focus; 2px `primary-ink` border + text when a value is chosen (an inset ring doubles the 1px border, so the label doesn't move) | WG contact form selects |
| Panel | white 5% fill, no outline (dialogs and the drawer: opaque `raised`), 16px radius | WG content blocks |
| Status stat | small white value over a grey sentence-case label (13px), optional dot, neon while live | WG header "● ONLINE", "61 FPS" |
| Label | small grey text over a value or a group of controls: 13px, sentence case, medium weight. Never above a heading: what an eyebrow would say goes into the heading or the sentence under it | WG header labels (type) |
| Headline | uppercase condensed display, one colour | INK "PLAY. WIN. EARN." |
| Image card | art fills the card (faint initials hold its place while a slow cover loads); platform · condition, the uppercase title (two lines at most), the price in neon and the store over the bottom, then the store count and the saving in plain text | INK "BUILD YOUR KINGDOM" cards |
| Compare grid (dialog) | "All offers / Compare" chips. Compare: highlight panels (neon value over a grey detail), then one panel per version (platform · condition · format) with a range bar on a scale shared by every version (neon dot = cheapest, hollow = out of stock) and one cell per store in the same order in every panel, so stores line up in columns and wrap on a phone. Cheapest cell has a neon edge; missing stores are dashed "Not listed" cells. The chosen view is remembered per browser | WG chips, WG panels, WG field underline (dashed variant) |
| Share | A secondary "Share" button beside the dialog's wishlist and cart buttons. On a phone it opens the share sheet; elsewhere it turns neon and "WhatsApp" and "Copy link" slide in beside it (tick and "Link copied" for 2 s). The link's preview (served by the API, not the app) is the cover, "Game: Rs 9,000 at Store" and the version, markdown and number of stores. On a phone the dialog's four buttons (wishlist, own, cart, share) take rows of their own under the cover and title, growing to fill the width; wider, they sit in one line beside the cover | WG chips and secondary buttons |
| Cart optimizer | Header: WG black circle with a bag and a neon count chip that pops on change. Dialog: "Delivering to" chips; one panel per game with its cover, the store and price the best plan picked, and version selects (neon when narrowed); the best plan in a neon-edged panel (total in the display face, neon), an order per store with neon price links, savings as pale neon chips; the single-store and each-cheapest alternatives as small panels | WG chips, WG selects, WG panels, INK headline type |
| Deals page | Its own path, `/deals`, reached from the header ("Deals", neon while on it) and the hero's "Or see today's deals". A compact top, so the first deals show on the first screen: the headline, a sentence that says when prices were checked, then one row of the library's Platform and Condition chips and jump buttons for its three lists (the jumps hidden on phones). Each list is a section with an INK headline ("Marked down.", "Shop around.", "Just in.") and a sentence naming it, over the usual card grid: two whole rows at whatever the column count, then "Show more". Deal cards add a neon sticker in the display face, tilted slightly ("−69%", "Save Rs 9,499", "In stock"), the struck-through was price, and a one-line note in place of the badges | INK headline type, INK price-tag stickers, WG chips, WG panels |
| Filters on phones | Below 768px the filter panel gives way to the search field and a round filters button beside it, its neon chip counting the filters in use. The button opens the filters in a drawer; choices there are a draft until "Show results" applies them and closes it, while the X, a tap outside or Esc close it unchanged. Reset clears the draft. Opening and closing whoosh like a dialog | Search field, WG round icon + neon count chip (as the cart), WG chips and selects |
| Wishlist and collection | Heart and tick in WG black circles at a card's top-left, shown on hover or focus (always on touch screens) and kept once on; wishlist = neon heart, owned = neon-filled circle with a black tick; the icon pops in with `ease.inkRoll`. The dialog has the same two as labelled buttons (secondary, neon when on). "Show: All games / Wishlist · n / Collection · n" chips top the filter bar; a list view gets a summary panel of big display figures (count, in stock, cost today in neon), notes for games the filters hide or no store lists, and backup export/import | WG round icon, WG chips, INK headline type |

## Motion

Built with [motion](https://motion.dev) (React) and [Lenis](https://lenis.darkroom.engineering/) smooth scrolling, plus [three.js](https://threejs.org/) for the footer's controller. Everything honours the OS "reduce motion" setting: motion goes instant, Lenis, the grain, stripes, equalizer and loading sweep stop, the loading screen is skipped, and the footer's controller is shown at rest.

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
| Header | Slides in after the loading screen, hides on scroll down, returns on scroll up, turns into an opaque bar once scrolled; stats count up | WG floating header + WG live FPS counter |
| Header | Round black badge with neon bars (grey when the API is offline); it's the sound switch, and the bars bounce while sound is on, with "● Sound" / "Muted" beside it on wide screens | WG audio control ("● AUDIO") |
| Hero | Wordmark letters slide up from a mask; "Ledger" in neon | INK split-text |
| Hero | One sentence saying what this is, then the search, its one action: "Find prices" (or Enter) lands on the library's results with the query applied (the field shares the library's search). "Or see today's deals" under it, which is also the way to the deals on phones | *new* |
| Hero | Real game covers, tilted, around the headline (two, above the title, on phones); each appears once its image has loaded; clip-path reveal; drift with scroll and pointer; straighten on hover | INK tilted art around its headline + INK clip-path |
| Hero | Two rows of huge words in a quiet grey (white 35%), sliding opposite ways on scroll: what the library covers | WG "Animation Website / 3D Game UX/UI Web3" rows |
| Hero | Headline shrinks and fades as you scroll past | WG block transitions |
| Sections | Rise 80px and fade in as they enter | WG blocks start `translate-y-[5rem]` |
| Buttons | Label rolls up, copy rolls in from below | INK `ButtonInnerMain` translateY(-100%) |
| Buttons | Darker fill on hover, press-in on click | WG hover states |
| Big buttons | Black circle icon spins to 330° on hover | WG `#big-button #icon` fastSpin |
| Chips | One neon pill glides between options (spring); labels roll | WG neon chip + INK roll |
| Search | Border turns neon on focus; example text rolls to the next every 2.6 s; clear button spins in | INK slide |
| Selects | Chevron flips, chosen select's border thickens, options cascade in | WG select states + INK stagger |
| Cards | Scroll-in stagger; cover wipes in (clip-path), fades in once loaded, and zooms on hover; 3D tilt toward the pointer; neon border on hover; arrow circle spins in; "View N offers" rises | INK cards, clip-path, tilt |
| Grid | Virtualized; when filters change, the old results fade while the new ones load, and cards that stay glide to their new place | — (CSS transition on each card's position) |
| Dialog | Grows out of the clicked card: a panel carrying the card's cover flies to the dialog's box while the cover fades, then hands over to the dialog; closing flies back into the card. Opened from a link (no card on screen), it rises and scales in with `ease.wg`. Then the title reveals by word; cover wipes in tilted; offers cascade; the cheapest offer keeps a neon edge; close icon spins | Material container transform, WG blocks, INK reveals, WG spinToClose |
| Header | Theme toggle: black circle, sun/moon roll through it; the new theme spreads in a circle from the button (View Transitions) | WG round icon + INK roll |
| Footer | Neon hazard stripes slide endlessly; giant black wordmark on neon rises as you reach the end | WG `#yellow-stripe-wrapper` + "Let's join forces" |
| Footer | WG's 3D controller, scrubbed by scroll down the tall neon panel: it rises from the bottom of the screen, tumbles, spins round and comes to rest on the wordmark at the page's end, reflections sweeping over it as it turns. Their model, environment map, camera and Theatre.js keyframes, on three.js r152 like theirs (`src/lib/controller-scene.ts`); loaded only as the footer comes near. On narrow screens the camera backs off so it fits across | WG `#section-skills` controller |
| Loading | Skeletons with a sweeping light band (`sweep`) | — |

### Loading screen (`src/components/loading-screen.tsx`)

WG's loader, on a first visit to the home page: shown at most once a week per browser, never on a link to something in particular (a shared game, /deals, a wishlist), and skipped with reduced motion. Nothing on it is faked: each loading step (fonts, ledger, stores, library, cover art) resolves only when that part of the page has loaded, and the letters and bar follow them. Steps are paced about 0.15 s apart so a fast load still reads as a sequence, and the screen never waits on loading for more than 3.5 s. Once loaded it waits for START (or any key, tap or click); a tap, click or Esc skips it before then. The parts marked *new* have no counterpart in the references.

| Part | Effect | Source |
|---|---|---|
| Backdrop | Plain black with the film grain | WG loader |
| Wordmark | The header's LootLedger wordmark, where the header's will land | WG loader logo |
| Live count | "Tracking" over the real game and store counts, counting up once the ledger is in ("Connecting…", or "Offline") | WG "Login / Player 1"; counts *new* |
| Letters | "LootLedger", one underline per letter. Each letter sharpens from a dim neon blur to neon as the progress passes it, left to right; all glow once ready | WG name entry |
| Bar | A pill filling with striped neon, the step in progress named above it | WG loading bar |
| START | Once the bar has filled completely and rested a moment, it turns into a glowing neon START button, which takes the focus; "Or press any key" / "Tap to start" under it | WG START |
| Exit (START) | The page jumps to the top (the screen also opens there, rather than where a reload left it), then the letters fly into the hero's title, one after another, each crossfading from the loader's neon letter into the title's own and landing on it exactly; the title then shows in their place (no slide-up). The black fades as the page's entrance starts behind, and START sinks away | WG exit (letters spreading over the page), flown into the title *new* |
| Exit (skip) | The letters spread large and blur away as the black fades | WG exit |

## Sound (`src/lib/sfx.ts`, `src/hooks/use-sound-effects.ts`)

Short effects, synthesized with the Web Audio API (no audio files): a few oscillators or a burst of filtered noise each. On by default, switched by the header's equalizer badge and remembered per browser. Browsers allow audio only after a click, tap or key, so the first sound is the first click. The effects come from listeners on the document, not from each component.

| When | Sound |
|---|---|
| Hovering something clickable (mouse only; not while the page scrolls under the pointer) | Faint high tick |
| Clicking a button or link | Soft falling blip over a tiny noise click |
| Switching something on: a chip, a select option, the wishlist, In stock only | Two notes up |
| Switching something off | Two notes down |
| A dialog opening / closing | Rising / falling whoosh |
| Scrolling with a mouse or trackpad (not touch) | A wheel-like tick every 140px, brighter and louder the faster the scroll |
| Turning sound back on | Two notes up, to confirm |
| START on the loading screen (or the key or tap that continues) | An arcade arpeggio up an octave over a rising whoosh. Often the visit's first gesture: the sound waits for audio to start |
