#!/usr/bin/env bash
# Bake a per-country locations.json from the deployed Greems CPO-backed endpoint.
#
# The CPO API key must NEVER ship in the static site, so the live pool list +
# geocodes are produced server-side and frozen into locations.json here.
#
# Usage:
#   ./bake_locations.sh <COUNTRY> <OUTFILE> <CLOUD_RUN_URL>
# Example:
#   ./bake_locations.sh CA ca/locations.json https://voltai-30142674525.me-west1.run.app
#   ./bake_locations.sh PL pl/locations.json https://voltai-30142674525.me-west1.run.app
#
# The voltai service must have the marketing blueprint deployed (route
# /ca/api/locations) and GREEMS_CPO_API_KEY set in its env. First call may take
# a few seconds while it geocodes new pools via Nominatim.
set -euo pipefail

COUNTRY="${1:?Usage: ./bake_locations.sh <COUNTRY> <OUTFILE> <CLOUD_RUN_URL>}"
OUT="${2:?Usage: ./bake_locations.sh <COUNTRY> <OUTFILE> <CLOUD_RUN_URL>}"
BASE="${3:?Usage: ./bake_locations.sh <COUNTRY> <OUTFILE> <CLOUD_RUN_URL>}"
URL="${BASE%/}/ca/api/locations?country=${COUNTRY}"

echo "Fetching ${URL} ..."
curl -fsS "$URL" -o "${OUT}.tmp"

COUNT=$(python3 -c "import json; print(len(json.load(open('${OUT}.tmp')).get('locations',[])))")
if [ "$COUNT" -eq 0 ]; then
  echo "WARNING: 0 locations for ${COUNTRY}. Check GREEMS_CPO_API_KEY and that ${COUNTRY} pools exist." >&2
  echo "Keeping existing ${OUT} (not overwriting with empty set)." >&2
  rm -f "${OUT}.tmp"
  exit 1
fi

mv "${OUT}.tmp" "$OUT"
echo "Baked ${COUNT} ${COUNTRY} locations into ${OUT}"
