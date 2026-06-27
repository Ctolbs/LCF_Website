#!/usr/bin/env python3
"""
Pull live review counts + ratings from Hospitable and write reviews.json.

Mapping chain (fully automatic, no manual table):
  properties.json hospitable_id
    -> booking API /bookings/api/properties/{id}  -> data.name (== public_name)
    -> public API  /v2/properties                 -> match public_name -> uuid
    -> public API  /v2/properties/{uuid}/reviews  -> meta.total (count) + avg(public.rating)

Auth: HOSPITABLE_PAT env var (GitHub secret in CI). Reads ~/.hospitable_pat as a
local fallback. Pass --write to emit reviews.json; default is a dry-run summary.
"""
import json, os, sys, time, urllib.request, urllib.error

PUB  = "https://public.api.hospitable.com/v2"
BOOK = "https://api.hospitable.com/bookings/api"

def pat():
    p = os.environ.get("HOSPITABLE_PAT")
    if p: return p.strip()
    fp = os.path.expanduser("~/.hospitable_pat")
    if os.path.exists(fp): return open(fp).read().strip()
    sys.exit("No HOSPITABLE_PAT env var or ~/.hospitable_pat file")

TOKEN = pat()

def api(url, auth=False, tries=3):
    headers = {"Accept": "application/json"}
    if auth: headers["Authorization"] = "Bearer " + TOKEN
    for t in range(tries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429 and t < tries-1:   # rate limited -> back off
                time.sleep(5 * (t+1)); continue
            raise
        except Exception:
            if t < tries-1: time.sleep(2); continue
            raise

def reviews_for(uuid):
    """Return (count, average_rating) by paginating all reviews."""
    ratings, total, page = [], 0, 1
    while True:
        rv = api(f"{PUB}/properties/{uuid}/reviews?per_page=50&page={page}", auth=True)
        meta = rv.get("meta", {})
        total = meta.get("total", total)
        for r in rv.get("data", []):
            rt = (r.get("public") or {}).get("rating")
            if isinstance(rt, (int, float)): ratings.append(rt)
        if page >= meta.get("last_page", 1): break
        page += 1; time.sleep(0.3)
    avg = round(sum(ratings)/len(ratings), 2) if ratings else None
    return total, avg, ratings

def main():
    write = "--write" in sys.argv
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    props = json.load(open(os.path.join(here, "properties.json")))["properties"]

    # public_name -> uuid (from public API)
    name_to_uuid = {}
    page = 1
    while True:
        r = api(f"{PUB}/properties?per_page=50&page={page}", auth=True)
        for p in r["data"]:
            if p.get("public_name"): name_to_uuid[p["public_name"].strip()] = p["id"]
        if page >= r["meta"]["last_page"]: break
        page += 1

    out, all_ratings, misses = {}, [], []
    for p in props:
        slug, hid = p["id"], p["hospitable_id"]
        try:
            book = api(f"{BOOK}/properties/{hid}")
            pubname = (book["data"]["name"] or "").strip()
        except Exception as e:
            misses.append((slug, f"booking API err: {e}")); continue
        uuid = name_to_uuid.get(pubname)
        if not uuid:
            misses.append((slug, f"no uuid for public_name: {pubname!r}")); continue
        count, avg, ratings = reviews_for(uuid)
        out[slug] = {"rating": avg, "count": count}
        all_ratings += ratings
        print(f"  {slug:28s} count={count:4d} avg={avg}  ({pubname[:40]})")
        time.sleep(0.4)

    total = sum(v["count"] for v in out.values())
    overall = round(sum(all_ratings)/len(all_ratings), 2) if all_ratings else None
    summary = {
        "total_reviews": total,
        "average_rating": overall,
        "property_count": len(out),
        "properties": out,
    }
    print(f"\nTOTAL reviews={total}  overall avg={overall}  properties matched={len(out)}/{len(props)}")
    if misses:
        print("UNMATCHED:")
        for s, why in misses: print(f"  {s}: {why}")

    if write:
        import datetime  # noqa
        # timestamp is passed via env in CI to keep runs reproducible; fallback omitted
        summary["updated"] = os.environ.get("RUN_DATE", "")
        with open(os.path.join(here, "reviews.json"), "w") as f:
            json.dump(summary, f, indent=2)
        print("Wrote reviews.json")

if __name__ == "__main__":
    main()
