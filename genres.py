"""Download game titles + genres from Wikidata into raw/wikidata_games.json.

Store feeds don't say what genre a game is, so build.py looks each game up in
this list. Wikidata is free and needs no API key. Re-run occasionally (e.g.
monthly) to pick up new releases; build.py works without it (no genres).

Usage:  python genres.py
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "raw" / "wikidata_games.json"
UA = "personal-game-library/0.1 (hobby price-comparison project)"

PLATFORMS = {  # Wikidata item ids
    "PS5": "Q63184502",
    "PS4": "Q5014725",
    "PS3": "Q10683",
    "Switch": "Q19610114",
    "Xbox One": "Q13361286",
}

# Many well-known games only have a language-neutral "mul" label (e.g. "Gran Turismo 7"),
# so accept both "en" and "mul".
QUERY = """
SELECT ?g (SAMPLE(?label) AS ?label) (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts)
       (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres) WHERE {
  ?g wdt:P400 wd:%s ; wdt:P31 wd:Q7889 ; rdfs:label ?label .
  FILTER(lang(?label) IN ("en", "mul"))
  OPTIONAL { ?g skos:altLabel ?alt . FILTER(lang(?alt) IN ("en", "mul")) }
  OPTIONAL { ?g wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(lang(?genreLabel) IN ("en", "mul")) }
} GROUP BY ?g
"""


def run(sparql):
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(sparql)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)["results"]["bindings"]


def main():
    games = {}
    for name, qid in PLATFORMS.items():
        print(f"{name}...", end=" ", flush=True)
        rows = run(QUERY % qid)
        for r in rows:
            gid = r["g"]["value"].rsplit("/", 1)[1]
            g = games.setdefault(gid, {"label": r["label"]["value"], "alts": [], "genres": []})
            g["alts"] = sorted(set(g["alts"]) | {a for a in r["alts"]["value"].split("|") if a})
            g["genres"] = sorted(set(g["genres"]) | {x for x in r["genres"]["value"].split("|") if x})
        print(len(rows))
        time.sleep(2)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(games, ensure_ascii=False), encoding="utf-8")
    print(f"saved {len(games)} games ({sum(1 for g in games.values() if g['genres'])} with genres)")


if __name__ == "__main__":
    main()
