# Greems GTA — charging map (static site, GitHub Pages)

Public marketing landing page promoting Greems EV charging across the Greater
Toronto Area. Static site → GitHub Pages at **https://gta.greems.io**.

## Contents
| File | Purpose |
|---|---|
| `index.html` | Landing page: animated logo, Leaflet/OSM map, app-store buttons, cookie banner |
| `privacy.html` | PIPEDA privacy notice + cookie policy + AODA/WCAG 2.0 AA accessibility statement |
| `logo.svg` / `icon.svg` | Animated "Greems GTA" signal-mark logo + compact icon |
| `locations.json` | Frozen list of CA charging pools `{name,address,city,lat,lng}` — **baked**, see below |
| `CNAME` | Custom domain (`gta.greems.io`) for GitHub Pages |
| `bake_locations.sh` | Regenerates `locations.json` from the live CPO API |

## Why locations are baked (not fetched live)
The Greems CPO API requires a secret key and sits behind a WAF — it cannot be
called from browser JavaScript. So the live pool list is fetched server-side and
frozen into `locations.json`. Coordinates are geocoded from each pool's address
via OpenStreetMap Nominatim (the CPO API returns no lat/lng).

## One-time setup
1. **Create the repo** (public): `greems/gta-charging`.
2. **Push these files** to the default branch.
3. **Enable Pages**: repo → Settings → Pages → Source = "Deploy from a branch",
   branch = `main`, folder = `/ (root)`.
4. **Custom domain**: Pages → Custom domain = `gta.greems.io` (the `CNAME` file
   already sets this). Enable "Enforce HTTPS" once the cert is issued.
5. **DNS**: add a CNAME record at your DNS provider:
   `gta.greems.io.  CNAME  greems-io.github.io.`
   (Apex/root domains would need A records instead — not applicable here.)

## Refreshing locations
Whenever GTA pools change, re-bake and push:
```bash
./bake_locations.sh https://<voltai-cloud-run-url>
git add locations.json && git commit -m "chore: refresh GTA locations" && git push
```
Verify pin accuracy after a refresh; fix any bad geocode by hand-editing the
`lat`/`lng` for that entry in `locations.json` (or seed it in voltai's
`assets/ca_pools_geo.json`).

## Compliance
- **PIPEDA** privacy notice + **AODA / WCAG 2.0 AA** accessibility statement in `privacy.html`, footer-linked.
- Essential-only cookies; no analytics/tracking. Cookie notice on first visit.
- Map data © OpenStreetMap contributors (attributed in-map and in footer).
