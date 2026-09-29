"""Download every store's product feed into raw/<store>.json.

Shopify stores expose /products.json; WooCommerce stores expose the
Store API (wc/store/v1/products). Both are public, read-only feeds the
stores' own themes use, so no HTML scraping is needed.

Usage:  python fetch.py            # all stores
        python fetch.py gamepark   # one store
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
RAW = ROOT / "raw"
UA = "Mozilla/5.0 (personal game price library)"
DELAY = 1.0  # seconds between requests, to be polite


def get_json(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except Exception as e:
            if attempt == tries - 1:
                raise
            print(f"    retry after error: {e}")
            time.sleep(5 * (attempt + 1))


def fetch_shopify(base):
    items, page = [], 1
    while True:
        batch = get_json(f"{base}/products.json?limit=250&page={page}")["products"]
        if not batch:
            return items
        items += batch
        print(f"    page {page}: {len(items)} products")
        page += 1
        time.sleep(DELAY)


def fetch_woocommerce(base):
    # ?rest_route= works even where /wp-json/ pretty URLs are blocked (gamepark.pk).
    # The default listing returns simple + variable products; variable products only
    # carry their cheapest price, so variations (new/used, PS4/PS5, disc/digital)
    # are fetched separately with type=variation and attached to their parent.
    def pages(extra):
        items, page = [], 1
        while True:
            batch = get_json(f"{base}/?rest_route=/wc/store/v1/products&per_page=100&page={page}{extra}")
            items += batch or []
            print(f"    page {page}: {len(items)} {'variations' if extra else 'products'}")
            if len(batch or []) < 100:
                return items
            page += 1
            time.sleep(DELAY)

    products = pages("")
    variations = pages("&type=variation")
    by_parent = {}
    for v in variations:
        by_parent.setdefault(v["parent"], []).append(v)
    for p in products:
        p["_variations"] = by_parent.get(p["id"], [])
    return products


FETCHERS = {"shopify": fetch_shopify, "woocommerce": fetch_woocommerce}


def main():
    stores = json.loads((ROOT / "stores.json").read_text())
    only = set(sys.argv[1:])
    RAW.mkdir(exist_ok=True)
    for s in stores:
        if only and s["id"] not in only:
            continue
        print(f"{s['name']} ({s['base']})")
        if s["platform"] not in FETCHERS:
            print(f"  skipped: {s['platform']} stores are only fetched by the server")
            continue
        try:
            products = FETCHERS[s["platform"]](s["base"])
        except Exception as e:
            print(f"  FAILED: {e} (keeping previous data, if any)")
            continue
        out = {"store": s, "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%S"), "products": products}
        (RAW / f"{s['id']}.json").write_text(json.dumps(out), encoding="utf-8")
        print(f"  saved {len(products)} products")


if __name__ == "__main__":
    main()
