# universal-game-store

Compare new and used PlayStation game prices across Pakistani game stores in one place.

## Features

- One library built from 7 stores' catalogs, with the same game grouped across stores
- Cheapest offer first, with new/used, PS4/PS5 and disc/digital shown for every offer
- A Compare view per game: prices by version (platform, condition, format) and store side by side, with how much you save by shopping around, buying used or buying the older console's copy
- A wishlist and a collection: mark games from any card or game page, see what your wishlist costs today, and back the lists up to a file. They are saved in your browser, so no account is needed
- Filter by genre, platform, condition, store and stock
- "Buy" links open the exact product page on the store's site

## Stores

| Store | Platform |
|---|---|
| [Venture Games](https://www.venturegames.com.pk) | Shopify |
| [GameStop.pk](https://gamestop.com.pk) | Shopify |
| [Games4U](https://games4u.pk) | Shopify |
| [Khanani Store](https://khananistore.com) | Shopify |
| [GamePark](https://gamepark.pk) | WooCommerce |
| [GameSource](https://gamesource.pk) | WooCommerce |
| [Sky Games](https://www.skygames.com.pk) | WooCommerce |

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

The data comes from each store's public product feed. The scripts don't scrape any HTML.

## Adding a store

If the store runs Shopify (`https://<store>/products.json` returns JSON) or WooCommerce, add one line to `stores.json`:

```json
{"id": "mystore", "name": "My Store", "platform": "shopify", "base": "https://mystore.pk"}
```

Then run `fetch.py` and `build.py`.

## Limitations

- Games are matched across stores by title, so titles spelled very differently between stores may show up as separate entries.
- About 80% of games have a genre.
- The wishlist and collection live in one browser. Use Export backup / Import backup to move them to another browser or device.
- Prices are only as fresh as your last fetch. The store's own page is the final word.

## Disclaimer

For personal use. Not affiliated with any of the listed stores. Product data and images belong to their respective owners.
