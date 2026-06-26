#!/usr/bin/env bash
#
# Migrate all property images off the expiring Hospitable CDN onto Cloudflare R2.
# Hospitable CDN URLs (assets.hospitable.com) carry tokens that 403 on expiry —
# this moves every image to a permanent R2 bucket and rewrites the references.
#
# ── One-time setup (you do this) ────────────────────────────────────────────
#   1. Create an R2 bucket (e.g. "lcf-images") and enable PUBLIC access:
#        - either a custom domain  -> https://images.lakecityflats.com
#        - or the dev URL          -> https://pub-xxxx.r2.dev
#   2. Configure an rclone remote for it:
#        rclone config   # n) new, name: r2, storage: s3, provider: Cloudflare,
#                        # access_key_id + secret from R2 API token, endpoint:
#                        # https://<accountid>.r2.cloudflarestorage.com
#      (rclone keeps the keys in its own config — they're never passed here.)
#
# ── Run (one command) ───────────────────────────────────────────────────────
#   R2_REMOTE=r2:lcf-images \
#   R2_PUBLIC_BASE=https://images.lakecityflats.com \
#   ./scripts/migrate-images-to-r2.sh
#
# Then review `git diff`, commit, and push — CI rebuilds the property pages
# (build.js reads the rewritten properties.json, so OG images update too).
#
set -euo pipefail
cd "$(dirname "$0")/.."

: "${R2_REMOTE:?set R2_REMOTE, e.g. r2:lcf-images}"
: "${R2_PUBLIC_BASE:?set R2_PUBLIC_BASE, e.g. https://images.lakecityflats.com (NO trailing slash)}"
R2_PUBLIC_BASE="${R2_PUBLIC_BASE%/}"

command -v rclone >/dev/null || { echo "rclone not found — install it first (brew install rclone)"; exit 1; }

STAGE="$(mktemp -d)"
echo "Staging in $STAGE"

# Files that reference CDN images: properties.json + hand-maintained pages
# (generated property/<slug>/ pages are rebuilt by build.js, so skip them).
FILES=$(grep -rl 'assets\.hospitable\.com/property_images' \
          --include='*.html' --include='*.json' . \
        | grep -vE '/property/[^/]+/index\.html$' || true)

echo "Collecting unique image URLs..."
grep -rhoE 'https://assets\.hospitable\.com/property_images/[A-Za-z0-9/_-]+\.(jpg|jpeg|png|webp)' \
  $FILES | sort -u > "$STAGE/urls.txt"
echo "  $(wc -l < "$STAGE/urls.txt" | tr -d ' ') unique images"

echo "Downloading (preserving path structure)..."
fail=0
while read -r url; do
  rel="${url#https://assets.hospitable.com/}"
  dest="$STAGE/files/$rel"
  mkdir -p "$(dirname "$dest")"
  if [ ! -s "$dest" ]; then
    curl -fsS "$url" -o "$dest" || { echo "  WARN failed: $url"; fail=$((fail+1)); }
  fi
done < "$STAGE/urls.txt"
echo "  download complete ($fail failures)"

echo "Uploading to R2 ($R2_REMOTE)..."
rclone copy "$STAGE/files/" "$R2_REMOTE/" --transfers 16 --checkers 16 --progress

echo "Rewriting references: assets.hospitable.com -> $R2_PUBLIC_BASE"
perl -pi -e "s{https://assets\\.hospitable\\.com/property_images/}{${R2_PUBLIC_BASE}/property_images/}g" $FILES
# Repoint the preconnect hint at the new host (harmless if absent)
perl -pi -e "s{(<link rel=\"preconnect\" href=\")https://assets\\.hospitable\\.com(\")}{\${1}${R2_PUBLIC_BASE}\${2}}g" $FILES || true

echo
echo "Done. Next:"
echo "  1) git diff   (sanity-check the URL rewrites)"
echo "  2) git add -A && git commit && git push   (CI rebuilds property pages)"
echo "  3) Spot-check a few live images + a social preview, then delete: $STAGE"
