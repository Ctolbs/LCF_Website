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
    """Return (count, average_rating, ratings, info) by paginating all reviews."""
    from collections import Counter
    ratings, total, page = [], 0, 1
    fetched = 0; plat = Counter(); unrated = 0
    while True:
        rv = api(f"{PUB}/properties/{uuid}/reviews?per_page=50&page={page}", auth=True)
        meta = rv.get("meta", {})
        total = meta.get("total", total)
        for r in rv.get("data", []):
            fetched += 1
            plat[r.get("platform", "?")] += 1
            rt = (r.get("public") or {}).get("rating")
            if isinstance(rt, (int, float)): ratings.append(rt)
            else: unrated += 1
        if page >= meta.get("last_page", 1): break
        page += 1; time.sleep(0.3)
    avg = round(sum(ratings)/len(ratings), 2) if ratings else None
    info = {"meta_total": total, "fetched": fetched, "unrated": unrated, "platforms": dict(plat)}
    return total, avg, ratings, info

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

    out, all_ratings, misses, plat_totals = {}, [], [], {}
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
        count, avg, ratings, info = reviews_for(uuid)
        out[slug] = {"rating": avg, "count": count}
        all_ratings += ratings
        flag = "" if info["meta_total"] == info["fetched"] else "  !!PAGINATION MISMATCH"
        for k in info["platforms"]:
            plat_totals[k] = plat_totals.get(k, 0) + info["platforms"][k]
        print(f"  {slug:28s} total={count:4d} fetched={info['fetched']:4d} unrated={info['unrated']:3d} "
              f"platforms={info['platforms']}{flag}")
        time.sleep(0.4)

    airbnb_count = sum(v["count"] for v in out.values())   # airbnb + direct + booking
    airbnb_sum = float(sum(all_ratings))

    # VRBO (and any other manual sources) blended in from reviews-manual.json
    vrbo_count, vrbo_sum = 0, 0.0
    mf = os.path.join(here, "reviews-manual.json")
    if os.path.exists(mf):
        for v in json.load(open(mf)).get("vrbo", []):
            c = v.get("count") or 0
            r = v.get("rating")
            vrbo_count += c
            if r: vrbo_sum += c * r

    combined_total = airbnb_count + vrbo_count
    combined_avg = round((airbnb_sum + vrbo_sum) / combined_total, 2) if combined_total else None

    summary = {
        "updated": os.environ.get("RUN_DATE", ""),
        "total_reviews": combined_total,
        "average_rating": combined_avg,
        "by_source": {**plat_totals, "vrbo": vrbo_count},
        "property_count": len(out),
        "properties": out,            # per-property Airbnb numbers (for cards)
    }
    print(f"\nPLATFORM BREAKDOWN (Hospitable API): {plat_totals}")
    print(f"Hospitable (airbnb+direct+booking): {airbnb_count} reviews  avg {round(airbnb_sum/airbnb_count,3)}")
    print(f"VRBO (manual):                      {vrbo_count} reviews  avg {round(vrbo_sum/vrbo_count,3) if vrbo_count else None}")
    print(f"COMBINED (truthful headline):       {combined_total} reviews  avg {combined_avg}")
    print(f"properties matched: {len(out)}/{len(props)}")
    if misses:
        print("UNMATCHED:")
        for s, why in misses: print(f"  {s}: {why}")

    if write:
        with open(os.path.join(here, "reviews.json"), "w") as f:
            json.dump(summary, f, indent=2)
        print("Wrote reviews.json")

if __name__ == "__main__":
    main()
