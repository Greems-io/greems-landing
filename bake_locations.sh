#!/usr/bin/env bash
# Bake locations.json from the deployed Greems CPO-backed endpoint.
#
# The CPO API key must NEVER ship in the static site, so the live pool list +
# geocodes are produced server-side and frozen into locations.json here.
#
# Usage:
#   ./bake_locations.sh https://<voltai-cloud-run-url>
#
# The voltai service must have the marketing blueprint deployed (route
# /ca/api/locations) and GREEMS_CPO_API_KEY set in its env. First call may take
# a few seconds while it geocodes new pools via Nominatim.
set -euo pipefail

BASE="${1:?Usage: ./bake_locations.sh https://<voltai-cloud-run-url>}"
URL="${BASE%/}/ca/api/locations"

echo "Fetching ${URL} ..."
curl -fsS "$URL" -o locations.json.tmp

# sanity: must be JSON with a non-empty locations array
COUNT=$(python3 -c "import json,sys; d=json.load(open('locations.json.tmp')); print(len(d.get('locations',[])))")
if [ "$COUNT" -eq 0 ]; then
  echo "WARNING: 0 locations returned. Check GREEMS_CPO_API_KEY on the service and that CA pools exist." >&2
  echo "Keeping existing locations.json (not overwriting with empty set)." >&2
  rm -f locations.json.tmp
  exit 1
fi

mv locations.json.tmp locations.json
echo "Baked ${COUNT} locations into locations.json"
