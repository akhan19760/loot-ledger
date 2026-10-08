# LootLedger

Compare new and used PlayStation game prices across Pakistani game stores in one place.

## Features

- One library built from 9 stores' catalogs, with the same game grouped across stores
- Cheapest offer first, with new/used, PS4/PS5 and disc/digital shown for every offer
- A Compare view per game: prices by version (platform, condition, format) and store side by side, with how much you save by shopping around, buying used or buying the older console's copy
- A wishlist and a collection: mark games from any card or game page, see what your wishlist costs today, and back the lists up to a file. They are saved in your browser, so no account is needed
- A cart optimizer: add the games you want to buy together and it finds the cheapest mix of stores with each store's delivery fee included, next to the cheapest single store and buying each game where it's cheapest
- A Deals page (`/deals`): the biggest discounts against each store's own earlier price, the biggest price gaps between stores for the same version of a game, and games newly in stock since the previous price check
- Filter by genre, platform, condition, store and stock
- "Buy" links open the exact product page on the store's site
- Share any game: its link (`/g/<game>`) previews in WhatsApp and other apps with the cover and today's cheapest price, then opens the game. On a phone, Share opens the share sheet; on a computer, it offers WhatsApp and Copy link

## Stores

| Store | Platform |
|---|---|
| [Venture Games](https://www.venturegames.com.pk) | Its own site (fetched by the server only) |
| [GameStop.pk](https://gamestop.com.pk) | Shopify |
| [Games4U](https://games4u.pk) | Shopify |
| [Khanani Store](https://khananistore.com) | Shopify |
| [GamePark](https://gamepark.pk) | WooCommerce |
| [GameSource](https://gamesource.pk) | WooCommerce |
| [Sky Games](https://www.skygames.com.pk) | WooCommerce |
| [Pak Game Shop](https://pakgameshop.com) | WooCommerce |
| [The Games Ocean](https://thegamesocean.com) | Payload CMS |

## Quick start

Requires Python 3.10+. There are no packages to install.

```bash
python genres.py   # one-time: download genres from Wikidata
python fetch.py    # download all store catalogs (~2-3 min)
python build.py    # build the library
```

Then open `site/index.html` in your browser.

On Windows, `update.bat` runs all three steps and opens the library.

## How it works

```
stores.json ─► fetch.py ─► raw/*.json ─┐
                                        ├─► build.py ─► site/data.js ─► site/index.html
genres.py ─► raw/wikidata_games.json ──┘
```

| File | Purpose |
|---|---|
| `stores.json` | List of stores |
| `fetch.py` | Downloads product feeds: Shopify `/products.json`, WooCommerce Store API |
| `genres.py` | Downloads game titles and genres from Wikidata |
| `build.py` | Classifies products, detects platform and condition, groups by game, adds genres |
| `site/index.html` | The library UI (static, no server needed) |

The data comes from each store's public product feed. The scripts don't scrape any HTML. The one exception is Venture Games: its own PHP site has no feed, so the server reads its category pages instead.

## Adding a store

If the store runs Shopify (`https://<store>/products.json` returns JSON), WooCommerce, or Payload CMS (`https://<store>/api/products` returns JSON; platform `"payload"`, fetched by the server only), add one line to `stores.json`:

```json
{"id": "mystore", "name": "My Store", "platform": "shopify", "base": "https://mystore.pk"}
```

Then run `fetch.py` and `build.py`.

## Delivery fees

The cart optimizer uses each store's delivery fees from `stores.json`: a `delivery` entry with the fee by number of games, for Karachi and for the rest of Pakistan (`fees[i]` is for i+1 games; the last applies to bigger orders). They were read from each store's own checkout, and stores change them, so re-check now and then:

```bash
pnpm --filter @ugs/server check:delivery              # every store
pnpm --filter @ugs/server check:delivery games4u      # just one
```

It fills anonymous carts with 1 to 6 games (nothing is ordered), asks for delivery to a Karachi and a Lahore address, and prints a `delivery` entry per store to paste into `stores.json`. A store without one is planned as free delivery, and the cart says so.

## Deploying

The site is deployed by GitHub Actions (`.github/workflows/deploy.yml`), to Netlify and Vercel from the same run. Neither host builds anything itself, because neither can hold the database: a serverless host can't keep a SQLite file or run the refresh scheduler. So the workflow does both jobs — it fetches the stores, rebuilds the library, and deploys the result — and the library is read-only between deploys.

The SQLite file is carried from one run to the next in the Actions cache, so each run starts from the last run's data and only fetches what is due. If GitHub evicts it, the next run fetches every store again.

Both hosts serve the same API — the routes in `server/src/app.ts`, answered from a snapshot by `server/src/serverless.ts` — packaged differently. A host contributes just two things, in `server/src/hosts/`: the response header its CDN reads, and where it finds the visitor's IP. `server/scripts/build-function.ts` adds the packaging and the routing.

| Host | Function | CDN header | Routing |
|---|---|---|---|
| Netlify | `netlify/functions/api.mjs` | `Netlify-CDN-Cache-Control` | the function's own `config.path`, plus `netlify.toml` |
| Vercel | `.vercel/output/` (Build Output API v3) | `CDN-Cache-Control` | the generated `config.json` |

To build either one by hand, after `pnpm --filter @ugs/web build`:

```bash
pnpm --filter @ugs/server build:netlify
pnpm --filter @ugs/server build:vercel
```

A manual run (Actions → Deploy → Run workflow) takes a `target` of `both`, `netlify` or `vercel`, and a `refresh` of `none`, `prices`, `genres` or `all`. On a schedule or a push to `main` it deploys everywhere. Prices refresh every other day and genres monthly; the cadence is set in three places the workflow's own comments point at, because `/api/status` reports when the next refresh is due.

The repository secrets it needs are listed at the top of the workflow. Both hosts must be set up *unlinked from Git*, or a push will start a host-side build that has no database and publishes a site with no API.

### Running it yourself

`server/src/index.ts` is a normal long-running Fastify server with a live SQLite file and the scheduler in-process, so it refreshes its own data and needs no deploy pipeline:

```bash
pnpm dev     # the API on :3001 and the web app on :5173
```

It serves the API only, not `web/dist`, so a static host or `@fastify/static` goes in front of it in production. Settings come from the environment, or from `server/.env` in development; `server/src/config.ts` lists them with their defaults.

## Limitations

- Games are matched across stores by title, so titles spelled very differently between stores may show up as separate entries.
- About 80% of games have a genre.
- Delivery fees are as checked on the date in `stores.json`, with Lahore standing in for everywhere outside Karachi. The store's checkout has the final word.
- The wishlist and collection live in one browser. Use Export backup / Import backup to move them to another browser or device.
- Prices are only as fresh as your last fetch. The store's own page is the final word.

## Disclaimer

For personal use. Not affiliated with any of the listed stores. Product data and images belong to their respective owners.
