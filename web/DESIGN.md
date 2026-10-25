# LootLedger design system: "Title Screen"

LootLedger is built like a big game's front end. The home page opens on a title screen, the navigation is a pause menu, today's biggest price gaps are fights, there's a bonus round, and the page ends on the credits. Box art plays the part of key art.

The direction was chosen from an options board (one decision per row: direction, type, palette, shape, header, hero, deals, library, footer, motion, extras) set against two reference sites, [1minus1.com](https://1minus1.com/) and [two26.studio](https://two26.studio/). Nothing is copied from them. They set the bar for finish, and these are the principles taken from them:

- **One loud typeface, used huge.** The display face runs from 2rem to about 9rem. Everything else is one quiet sans. Most of the drama comes from that jump in size.
- **Three colours, held to.** Ink, lime and bone. There are no gradients, no glow (one exception: the loading screen's START) and no blur, not even in the header.
- **Colour comes in whole blocks.** The pause menu, the dearer half of a fight, the achievement toast and the finale are solid lime with ink type, never lime glowing on black.
- **One shape language.** Every corner is cut at 45°, and nothing is rounded.
- **A quiet header.** The wordmark, the cart and one Menu button. No stats.
- **One choreographed move per section.** Each section has a single scroll-driven moment and stays still otherwise.
- **Box art, big.** The covers are the only real media, so they're shown large and tilted.
- **A voice.** Game language: Featured, Up next, Round 1, K.O., Bonus round, Paused, Resume, Thanks for playing, Return to title.
- **A finale.** The page ends on the credits and a lime block, not on a list of links.

## Fonts

Self-hosted via Fontsource (`src/index.css`, `--font-*`).

| Role | Font | Used for |
|---|---|---|
| Display (`font-display`) | **Dela Gothic One**, always uppercase, leading 0.84–0.92 | Titles, prices, menu items, the wordmark, stickers |
| Text and UI (`font-sans`) | **Mona Sans** (variable weight) | Sentences, buttons, chips, fields, tables |
| Label (`label-caps`) | Mona Sans 650, 12px, tracking 0.14em, uppercase | The small second voice: "Cheapest today", "Up next", "Shop around", section labels |

Two voices on a game card: the name in Mona Sans bold uppercase, the price in Dela Gothic. Figures are tabular everywhere (`tabular-nums` on `<html>`).

## Colours (Lime Ink)

| Token | Dark (default) | Light | Use |
|---|---|---|---|
| `background` | `#0b0c0e` ink | `#eeede8` bone | The page |
| `foreground` | `#eeede8` bone | `#0b0c0e` ink | Type |
| `primary` | `#d4fb08` lime | `#d4fb08` lime | Fills: buttons, chosen chips, blocks. Always with ink type on it |
| `primary-ink` | lime | ink | Lime as a text colour: prices, "Ledger". It turns ink on bone, where lime can't be read |
| `raised` / `popover` | `#1a1b1f` graphite | `#f8f7f3` | Dialogs, panels, cover backs |
| `secondary` / `muted` / `accent` | bone 8% | ink 7% | Flat chips, fields and secondary buttons |
| `surface` | bone 4.5% | ink 4.5% | Large panels (the filter bar) |
| `muted-foreground` | bone 62% | ink 62% | Secondary text |
| `destructive` | `#ff5236` | `#d42600` | Errors, a wrong guess |

The four colours also exist by name (`ink`, `bone`, `lime`, `graphite`) for things that mean the colour itself, such as an ink button on a lime block. `.on-lime` makes any element a lime block: ink type, ink lines and ink muted text, in either theme. The hero, the fights and the credits carry `dark`, so they stay ink in the light theme. The pause menu and the finale are lime in both themes.

Platform bands on the shelf use each console's own case colours: PS5 `#f4f4f2`, PS4 `#003791`, Switch `#e60012`, Xbox `#107c10`. These are content, not palette.

## Shape

| Utility | Cut | Used for |
|---|---|---|
| `chamfer` | 12px | Buttons, fields, covers, cards, panels |
| `chamfer-sm` | 7px | Chips, icon buttons, selects, small covers |
| `chamfer-xs` | 4px | Tags and badges |
| `chamfer-lg` | 22px | Dialogs, the hero cover, big panels |
| `chamfer-top` | top-left only | The phone drawer |

The radius tokens are all 0. The chamfer is a clip-path, so it clips anything drawn outside the box. Focus therefore shows as an inset outline (`outline-offset: -4px`), and outlined boxes are avoided because the cut corners would break the line. Separation comes from fills and tone steps instead.

## Layout

- The page gutter is 16px on phones and 32px from `md` up. The hero, the fights and the credits run edge to edge, with their content on the same gutter.
- Labels sit above headlines and are left-aligned. Headlines are as big as their column allows.
- The grid has a 12px column gap and a 28px row gap. Covers are 4:5, with a fixed 124px of text beneath (the virtualized grid relies on that height).
- The header is 80px tall (60px on phones), transparent at the top and solid ink once scrolled.

## Sections (home page, top to bottom)

| Section | What it is | Its one move |
|---|---|---|
| **Title screen** (`hero.tsx`) | The wordmark as a game logo, then one featured game: its cover tilted on a lime plate, its cheapest price as the biggest figure on the page, its title as large as two lines allow. "Up next" shows the queue; segments run along the bottom | Attract mode: every 7s the next game wipes in from the side it's coming from, and the plate turns. It pauses on hover or focus, off screen and in a hidden tab. Arrows, ← → keys and the segments move by hand |
| **Shop around** (`versus.tsx`) | Today's three biggest price gaps as fights: the same game and version at two shops, ink against lime across a diagonal split, with fighting-game health bars | Pinned. Scrolling drains the dearer shop's bar while the damage (the rupees saved) counts up, then K.O. A wipe brings in the next round. With reduced motion the rounds stack, already decided |
| **Bonus round** (`bonus-round.tsx`) | Higher or Lower with today's real cheapest prices. The best streak is kept per browser, and a tie counts as right | The hidden price counts up on reveal, and the cover frames lime (right) or red (wrong) |
| **Library** (`App.tsx`, `shelf-view.tsx`, `virtual-game-grid.tsx`) | A heading with a Shelf / Grid switch (remembered per browser; the shelf by default with a mouse, the grid on touch), the filter panel, then the games | **Shelf:** spines cut from each cover, with the console band on top and the price on a lime foot. Reached for, a spine slides up and its case turns out to show the cover. **Grid:** big unboxed covers; reached for, the cover steps back into a lime frame |
| **Credits** (`site-footer.tsx`) | "Prices by" and the nine shops, each linking to its site; then credits (games tracked, offers, last check), role and name either side of a centre gutter | Lines rise in as they scroll up, like a roll. It ends in a lime block: "Thanks for playing", the small print, and Return to title |

The deals page (`/deals`) uses the same parts: the label, a huge title, the filter panel and grids of cards with a tilted lime sticker (−58%, Save Rs 12,001).

## Header and pause menu (`site-header.tsx`)

The bar holds the wordmark (hidden over the title screen, which has its own), the cart (a chamfered square with a lime count) and **Menu** (lime). It slides in after the intro, tucks away while scrolling down and returns on the way up.

Menu opens the **pause screen**, a full-screen lime block that wipes down:

- **Items:** huge items (Resume, Library, Deals, Shop around, Wishlist, Collection, The shops), each with a hint on the right.
- **Marker:** an ink ▶ glides to whichever item the pointer, the keyboard (↑ ↓ Home End) or focus is on, with a tick each time it moves.
- **Options and status:** an ink panel with Sound and Theme, and the live status (online, last price check, counts).
- **Closing:** Esc or Resume closes it. Choosing an item closes the menu first, then travels.

## Achievements (`hooks/use-achievements.ts`, `components/achievements.tsx`)

Five real moments, each unlocked once per browser and announced by a lime toast that wipes in at the bottom left:

- First pick (a game added to the wishlist).
- Collector (a game marked as owned).
- Window shopper (ten games' prices opened).
- Shopped around (a cart whose cheapest mix saves Rs 2,000 or more).
- Price sense (five in a row in the bonus round).

Additions are counted when they happen, not when a shelf from an earlier visit loads.

## Motion (cinematic)

Nothing bounces. Reveals run 0.6–1.2s; wipes are clip-path insets. One move per section (see the table above), smooth scrolling (Lenis), and reduced motion turns every scroll scene into its finished state.

| Token (`src/lib/motion.ts`) | Curve | Use |
|---|---|---|
| `ease.cine` | `cubic-bezier(0.16, 1, 0.3, 1)` | Every reveal, rise, hover and roll |
| `ease.cineInOut` | `cubic-bezier(0.76, 0, 0.24, 1)` | Wipes that cover and uncover: the hero's covers, rounds, the pause menu, toasts |
| `ease.wg`, `ease.wgInOut` | as before | The loading screen and the game dialog's flight, kept from the original |

| Element | Effect |
|---|---|
| Buttons | The label rolls up on hover (0.6s, `cine`); the square's arrow nudges the way it points; press scales to 0.97 |
| Chips | One lime block glides between options (spring, no bounce) |
| Cards | They rise 48px while the cover wipes up from a 1.2× zoom, staggered by column |
| Headings | Split by word (or letter) and slid up out of a mask |
| Game dialog | Grows out of the clicked card or cover and flies back into it on close |

## Loading screen: the boot sequence (`loading-screen.tsx`)

This is kept from the original design at the user's request, now in Dela Gothic and Mona Sans. It shows on a first visit to the home page at most once a week per browser, never on a link to something in particular, and never with reduced motion. Each loading step (fonts, ledger, stores, library, cover art) resolves only when that part has really loaded. The bar then turns into START (the one glow on the site), and on START the letters fly into the title screen's wordmark (`#hero-title`) and land on it exactly.

## Sound (`src/lib/sfx.ts`, `src/hooks/use-sound-effects.ts`)

Short synthesized effects, on by default and switched in the pause menu's Options:

- **Pointer and clicks:** a faint tick on hover; a soft blip on click.
- **Switches:** two notes up for on, two notes down for off.
- **Dialogs and the menu:** a whoosh as one opens or closes.
- **Movement:** a tick as the pause menu's marker moves, as the hero turns and as each round starts.
- **Bonus round:** two notes up for a right guess, two down for a wrong one.
- **Achievements:** two notes up as the toast arrives.
- **START:** the loading screen's START plays an arcade arpeggio.
