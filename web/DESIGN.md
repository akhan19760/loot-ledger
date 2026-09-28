# Design system

Every token and component style below comes from one of two references:

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
