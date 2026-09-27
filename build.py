"""Turn raw/<store>.json feeds into one library: site/data.js.

Every store variant becomes a *listing* (store, platform, condition, price, link).
Listings for the same game are grouped under one *game* using a normalized title,
so the library can show "cheapest offer across all stores" per game.

Usage:  python build.py
"""
import html
import json
import re
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).parent
RAW = ROOT / "raw"
OUT = ROOT / "site" / "data.js"


def rx(pattern):
    return re.compile(pattern, re.I)


# ---------------------------------------------------------------- platform

PLATFORMS = [  # order matters: more specific first
    ("PS5", rx(r"\bps ?5\b|playstation ?®? ?5|\bpsvr ?2\b|\bps vr2\b")),
    ("PS4", rx(r"\bps ?4\b|playstation ?®? ?4|\bps ?vr\b")),
    ("PS3", rx(r"\bps ?3\b|playstation ?3")),
    ("Switch 2", rx(r"\bswitch ?2\b")),
    ("Switch", rx(r"\bswitch\b|nintendo")),
    ("Xbox Series", rx(r"xbox series|\bseries [xs]\b|\bxsx\b")),
    ("Xbox One", rx(r"xbox ?one")),
    ("Xbox", rx(r"\bxbox\b")),
    ("PC", rx(r"\bpc\b|\bsteam\b")),
]


def detect_platform(*texts):
    """First text that mentions a platform wins (variant > title > tags/categories)."""
    for text in texts:
        if not text:
            continue
        hits = [(m.start(), i, name) for i, (name, r) in enumerate(PLATFORMS) if (m := r.search(text))]
        if hits:
            return min(hits)[2]  # earliest mention in that text; ties go to the more specific name
    return None


# ---------------------------------------------------------------- condition / format

USED = rx(r"\bused\b|pre-?owned|second ?hand|\brefurb")
NEW = rx(r"\bnew\b|brand new|sealed")
DIGITAL = rx(r"\bdigital\b|\b(primary|secondary)\b|\baccount\b|\b(digital|download|game|voucher) code\b")


def detect_condition(*texts):
    for text in texts:
        if not text:
            continue
        if USED.search(text):
            return "used"
        if NEW.search(text) and not rx(r"new (arrival|games?)").search(text):
            return "new"
    return "new"  # stores list new stock unless they say otherwise


# ---------------------------------------------------------------- kind

GIFTCARD = rx(
    r"gift ?card|\bpsn\b|wallet|top.?up|\$ ?\d+|\d+ ?(usd|dollars?)\b|playstation plus|ps plus|"
    r"game ?pass|membership|subscription|eshop card|\bcredit\b|\bv-?bucks\b"
)
# Strong: these words in a title mean hardware even if the store filed it under "Games".
STRONG_HW = rx(
    r"controller|dualsense|dualshock|joy-?con|gamepad|headset|headphone|earbud|earphone|speaker|"
    r"charg(er|ing)|\bdock\b|\bstand\b|cooling|cable|adapter|\bhdmi\b|keyboard|mouse ?pad|"
    r"monitor|\bchair\b|joystick|arcade stick|fight ?stick|racing wheel|steering|pedal|"
    r"\bssd\b|\bhdd\b|nvme|hard ?drive|memory card|\bsd card\b|\bskin\b|faceplate|cover plate|dust cover|"
    r"thumb ?grip|protector|tempered|carrying case|travel case|\bpouch\b|\bbag\b|"
    r"t-?shirt|hoodie|amiibo|funko|figurine|keychain|\bmug\b|poster|sticker|"
    r"\bconsole\b(?! edition)|\b(ps ?[45]|playstation ?[45]?|xbox)\b.{0,15}\b(slim|pro)\b|\b\d+ ?(gb|tb)\b|"
    r"oled|switch lite|steam deck|rog ally|legion go|playstation portal|\bvr ?2? headset\b|meta quest|oculus|"
    r"\bbattery|\bbatteries|\blaptop\b|\bsmart ?watch|\bpower ?bank|retro game|game stick"
)
# Weak: only count when the store does not file the product under a games category
# (so "Mouse: P.I. For Hire" in "PS5 Games" stays a game).
WEAK_HW = rx(r"\bmouse\b|\bcase\b|\bcap\b|\bfigure\b|\bfan\b|\bcamera\b|\bremote\b|\bhandheld\b|"
             r"\bled\b|\brgb\b|\blamp\b|\bmat\b|\bgrip\b|\bwrap\b|\blight\b")
GAME_SIGNAL = rx(r"\bgames?\b|video ?game")
NOT_GAME_SIGNAL = rx(r"gift|card|accessor|console|controller|apparel|merch|hardware|gaming")
HW_META = rx(r"accessor|console|controller|headset|chair|monitor|keyboard|mouse|apparel|merch")


def detect_kind(title, meta):
    """meta is the list of the store's own tags / categories / product type."""
    game_cat = any(GAME_SIGNAL.search(m) and not NOT_GAME_SIGNAL.search(m) for m in meta)
    if GIFTCARD.search(title):
        return "giftcard"
    if STRONG_HW.search(title):
        return "hardware"
    if WEAK_HW.search(title) and not game_cat:
        return "hardware"
    if game_cat:
        return "game"
    if any(GIFTCARD.search(m) for m in meta):
        return "giftcard"
    if any(HW_META.search(m) for m in meta):
        return "hardware"
    return "game" if detect_platform(title) else "other"


# ---------------------------------------------------------------- title normalization

STRIP = [
    r"\(?\bused( game)?\b\)?", r"pre-?owned", r"\bbrand new\b", r"\(new\)", r"\bnew\b$",
    r"\b(usa|uk|eu|euro|asia|asian|arabic|middle east|japan|jp)\b( region| version)?",
    r"\b(us|me)\s+(region|version)\b|\(\s*(us|me)\s*\)|\br[0-9]\b|\bregion ?[0-9]\b",
    r"\bregion\b( free)?", r"\bversion\b", r"\bdisc\b|\bcd\b|\bphysical\b|\bdigital( code| game)?\b",
    r"\bfor\b(?=\s*(ps|playstation|nintendo|switch|xbox))",
    r"(\bps ?[345]|playstation ?[345]?|nintendo switch ?2?|\bswitch ?2?|\bpsp|xbox[a-z |/]*)\s+(video )?games?\b",
    r"\b(greatest hits|playstation hits|ps hits|nintendo selects|steelbook)\b",
    r"playstation ?®? ?[345]|\bps ?[345]\b|\bps ?vr ?2?\b|nintendo switch ?2?|\bswitch ?2?\b|\bnintendo\b",
    r"xbox series [xs](\s*[|/]\s*[xs])?|xbox one( [xs](\s*[|/]\s*[xs])?)?|\bxbox\b|\bpc\b",
    r"\b(standard|deluxe|gold|ultimate|launch|day ?(one|1)|premium|special|limited|collector'?s|"
    r"complete|digital deluxe|standard game)\s+(edition|ed\.?|version)\b",
    r"\bedition\b",
]
STRIP_RX = [rx(p) for p in STRIP]


def clean_title(raw):
    t = html.unescape(raw)
    t = re.sub(r"[®™©]", "", t)
    for r in STRIP_RX:
        t = r.sub(" ", t)
    t = re.sub(r"\(\s*\)|\[\s*\]", " ", t)
    t = re.sub(r"\s*[-–—|/,:]+\s*$", "", t.strip())  # dangling separators
    t = re.sub(r"^\s*[-–—|/,:]+\s*", "", t)
    t = re.sub(r"\s+[-–—|]+\s+[-–—|]+\s+", " - ", t)
    t = re.sub(r"\s{2,}", " ", t).strip(" -–—|/,:")
    t = re.sub(r"\s+for$", "", t)  # "Wreckreation for - PS5"
    return t or html.unescape(raw).strip()


ROMAN = {"ii": "2", "iii": "3", "iv": "4", "v": "5", "vi": "6", "vii": "7", "viii": "8", "ix": "9", "x": "10",
         "xi": "11", "xii": "12", "xiii": "13", "xiv": "14", "xv": "15", "xvi": "16"}


def game_key(cleaned):
    """Lowercase ASCII key used to match the same game across stores and Wikidata."""
    k = unicodedata.normalize("NFKD", cleaned).encode("ascii", "ignore").decode()  # Ragnarök -> Ragnarok
    k = k.lower().replace("&", " and ")
    k = re.sub(r"['’`]", "", k)
    k = re.sub(r"[^a-z0-9]+", " ", k)
    words = [ROMAN.get(w, w) for w in k.split()]
    words = [w for i, w in enumerate(words) if not (w == "part" and i + 1 < len(words) and words[i + 1].isdigit())]
    if words and words[0] == "the":
        words = words[1:]
    return " ".join(words)


# ---------------------------------------------------------------- genres (Wikidata)

# Wikidata genres are very specific ("action-adventure game", "soulslike", ...);
# fold them into a short list that is useful for browsing. Order = display order.
GENRE_MAP = [
    ("Action", r"\baction\b|hack and slash|beat 'em up|soulslike|character action"),
    ("Adventure", r"adventure|visual novel|interactive film|walking simulator"),
    ("RPG", r"role-playing|\brpg\b|jrpg|dungeon crawl"),
    ("Shooter", r"shooter|shoot 'em up|battle royale|\bfps\b"),
    ("Sports", r"sports|football|soccer|basketball|cricket|golf|tennis|wrestling|boxing|hockey|baseball|"
               r"skateboard|snowboard|\bmma\b|mixed martial|olympic|cycling|volleyball"),
    ("Racing", r"racing|driving|kart"),
    ("Fighting", r"fighting|brawler"),
    ("Platformer", r"platform|metroidvania"),
    ("Open World", r"open world|sandbox"),
    ("Horror", r"horror"),
    ("Survival", r"survival"),
    ("Stealth", r"stealth"),
    ("Strategy", r"strategy|tactic|4x|tower defense|real-time tactics|grand strategy|card game|deck-building"),
    ("Simulation", r"simulat|farming|management|city-building|god game|flight"),
    ("Puzzle", r"puzzle|logic"),
    ("Roguelike", r"roguelike|roguelite"),
    ("Party & Music", r"party|music|rhythm|dance|trivia|board game"),
    ("Online / MMO", r"massively multiplayer|\bmmo"),
]
GENRE_RX = [(name, rx(p)) for name, p in GENRE_MAP]


def broad_genres(wikidata_genres):
    found = {name for g in wikidata_genres for name, r in GENRE_RX if r.search(g)}
    return [name for name, _ in GENRE_MAP if name in found]


def load_genre_index():
    path = RAW / "wikidata_games.json"
    if not path.exists():
        print("(no raw/wikidata_games.json - run genres.py to add genres)")
        return {}
    index = {}
    for g in json.loads(path.read_text(encoding="utf-8")).values():
        genres = broad_genres(g["genres"])
        if not genres:
            continue
        for name in [g["label"], *g["alts"]]:
            key = game_key(clean_title(name))
            if key and key not in index:
                index[key] = genres
            elif key and index[key] != genres and name == g["label"]:
                index[key] = sorted(set(index[key]) | set(genres), key=[n for n, _ in GENRE_MAP].index)
    return index


# Last-resort hints for yearly franchises that stores abbreviate ("FC 25", "NHL 20").
TITLE_HINTS = [
    (rx(r"^(ea sports )?(fifa|fc|nba|nhl|madden|mlb|pga|ufc|wwe|pes|efootball|cricket|tennis|golf)\b"), ["Sports"]),
    (rx(r"^(f1|motogp|wrc|dirt|nascar|need for speed|gran turismo|forza|crash team|ride)\b|racing|rally"), ["Racing"]),
    (rx(r"^(call of duty|battlefield|doom|far cry|borderlands|destiny)\b"), ["Shooter"]),
    (rx(r"^(dragon ?ball|mortal kombat|tekken|street fighter|naruto)\b"), ["Fighting"]),
]


def lookup_genres(key, index):
    """Exact title match first; then drop trailing words ("... Directors Cut", "... Remastered")
    and a leading "marvels" / "tom clancys" etc. Good enough for genres, even if the
    fallback lands on another entry of the same series."""
    if key in index:
        return index[key]
    for r, genres in TITLE_HINTS:
        if r.search(key):
            return genres
    words = key.split()
    for prefix in ("marvels", "tom clancys", "sid meiers", "disney", "lego", "ea sports", "ea"):
        p = prefix.split()
        if words[:len(p)] == p and " ".join(words[len(p):]) in index:
            return index[" ".join(words[len(p):])]
    while len(words) > 2:
        words = words[:-1]
        k = " ".join(words)
        if k in index and len(k) >= 8:
            return index[k]
    return []


# ---------------------------------------------------------------- store adapters

def shopify_listings(store, p):
    base = store["base"]
    title = html.unescape(p["title"])
    meta = [p.get("product_type") or ""] + list(p.get("tags") or [])
    image = (p.get("images") or [{}])[0].get("src") if p.get("images") else None
    single = len(p["variants"]) == 1
    for v in p["variants"]:
        vtitle = "" if v["title"] == "Default Title" else v["title"]
        price = float(v["price"] or 0)
        compare = float(v.get("compare_at_price") or 0)
        yield {
            "raw_title": title,
            "variant": vtitle,
            "meta": meta,
            "price": price,
            "was": compare if compare > price else None,
            "in_stock": bool(v.get("available")),
            "url": f"{base}/products/{p['handle']}" + ("" if single else f"?variant={v['id']}"),
            "image": (v.get("featured_image") or {}).get("src") or image,
        }


def woo_price(prices):
    minor = int(prices.get("currency_minor_unit") or 0)
    return float(prices.get("price") or 0) / 10**minor, float(prices.get("regular_price") or 0) / 10**minor


def woo_link(store, permalink):
    """Some stores' pretty product URLs 404 (gamepark.pk, as of Sept 2026) while
    ?product=<slug> works; stores.json sets "link_style": "query" for those."""
    if store.get("link_style") != "query":
        return permalink
    path, _, query = permalink.partition("?")
    slug = path.rstrip("/").rsplit("/", 1)[-1]
    return f"{store['base']}/?product={slug}" + (f"&{query}" if query else "")


def woo_listings(store, p):
    title = html.unescape(p["name"])
    meta = [html.unescape(c["name"]) for c in p.get("categories", []) + p.get("tags", [])]
    image = p["images"][0]["src"] if p.get("images") else None
    rows = p.get("_variations") or [p]
    for v in rows:
        price, regular = woo_price(v["prices"])
        yield {
            "raw_title": title,
            "variant": html.unescape(v.get("variation") or "") if v is not p else "",
            "meta": meta,
            "price": price,
            "was": regular if regular > price else None,
            "in_stock": bool(v.get("is_in_stock")) and bool(v.get("is_purchasable", True)),
            "url": woo_link(store, v.get("permalink") or p["permalink"]),
            "image": (v["images"][0]["src"] if v.get("images") else None) or image,
        }


ADAPTERS = {"shopify": shopify_listings, "woocommerce": woo_listings}


# ---------------------------------------------------------------- build

def build():
    listings, stores = [], []
    for s in json.loads((ROOT / "stores.json").read_text()):
        f = RAW / f"{s['id']}.json"
        if not f.exists():
            print(f"(skipping {s['name']}: no raw data - run fetch.py)")
            continue
        data = json.loads(f.read_text(encoding="utf-8"))
        store = s  # current settings from stores.json
        stores.append({"id": store["id"], "name": store["name"], "base": store["base"], "fetched_at": data["fetched_at"]})
        for p in data["products"]:
            for l in ADAPTERS[store["platform"]](store, p):
                if l["price"] <= 0:  # "call for price" / placeholder products
                    continue
                full = f"{l['raw_title']} {l['variant']}"
                l["store"] = store["id"]
                meta = " | ".join(l["meta"])
                l["platform"] = detect_platform(l["variant"], l["raw_title"], meta)
                l["condition"] = detect_condition(l["variant"], l["raw_title"], meta)
                l["format"] = "digital" if DIGITAL.search(full) else "disc"
                l["kind"] = detect_kind(l["raw_title"], l["meta"])
                listings.append(l)

    games = defaultdict(list)
    for l in listings:
        cleaned = clean_title(l["raw_title"])
        l["_clean"] = cleaned
        games[(l["kind"], game_key(cleaned))].append(l)

    genre_index = load_genre_index()
    out = []
    for (kind, key), ls in games.items():
        if not key:
            continue
        names = Counter(l["_clean"] for l in ls)
        title = sorted(names, key=lambda n: (-names[n], len(n)))[0]
        ls.sort(key=lambda l: (not l["in_stock"], l["price"]))
        out.append({
            "id": f"{kind}:{key}".replace(" ", "-"),
            "title": title,
            "kind": kind,
            "genres": lookup_genres(key, genre_index) if kind == "game" else [],
            "image": next((l["image"] for l in ls if l["image"]), None),
            "listings": [
                {k: l[k] for k in ("store", "raw_title", "variant", "platform", "condition", "format",
                                   "price", "was", "in_stock", "url")}
                for l in ls
            ],
        })
    out.sort(key=lambda g: g["title"].lower())

    OUT.parent.mkdir(exist_ok=True)
    payload = {"generated": time.strftime("%Y-%m-%d %H:%M"), "stores": stores, "games": out}
    OUT.write_text("window.LIBRARY = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")

    kinds = Counter(g["kind"] for g in out)
    print(f"{len(listings)} listings -> {len(out)} grouped items {dict(kinds)}")
    multi = sum(1 for g in out if g["kind"] == "game" and len({l['store'] for l in g['listings']}) > 1)
    print(f"games sold by 2+ stores: {multi}")
    g = [x for x in out if x["kind"] == "game"]
    print(f"games with a genre: {sum(1 for x in g if x['genres'])}/{len(g)}")
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    build()
