# Greems landing pages (static site, GitHub Pages)

Public marketing landing pages for the Greems EV charging network, one per
region. Static site → GitHub Pages at **https://lp.greems.io**.

```
/                 country picker (lp.greems.io)
/ca               Canada — Greater Toronto Area (LIVE)
/pl               Poland   (scaffold — see pl/TODO.md)
/be               Belgium  (scaffold — see be/TODO.md)
logo.svg/icon.svg generic "Greems Charging" animated mark (root + scaffolds)
bake_locations.sh regenerates a country's locations.json from the live CPO API
CNAME             lp.greems.io
```

Each live country folder holds: `index.html` (map + app buttons), `privacy.html`
(region-appropriate legal), `logo.svg`/`icon.svg` (region wordmark), and a
**baked** `locations.json`.

## Why locations are baked (not fetched live)
The Greems CPO API needs a secret key and sits behind a WAF — it can't be called
from browser JS. The live pool list is fetched server-side and frozen into each
country's `locations.json`. Coordinates come from geocoding the address via
OpenStreetMap Nominatim (the CPO API returns no lat/lng).

## One-time setup
1. Repo (public): `Greems-io/greems-landing`.
2. Push to default branch.
3. Pages: Settings → Pages → Source = branch `main`, folder `/ (root)`.
4. Custom domain: `lp.greems.io` (set by the `CNAME` file). Enforce HTTPS once
   the cert is issued.
5. DNS: `lp.greems.io.  CNAME  greems-io.github.io.`

## Refreshing a country's locations
```bash
./bake_locations.sh CA ca/locations.json https://<voltai-cloud-run-url>
git add ca/locations.json && git commit -m "chore: refresh CA locations" && git push
```
Verify pin accuracy after a refresh; fix a bad geocode by hand-editing `lat`/`lng`
in that country's `locations.json` (or seed it in voltai's `assets/ca_pools_geo.json`).

## Adding a new country (PL / BE)
See `pl/TODO.md` and `be/TODO.md`. EU countries need **GDPR + ePrivacy opt-in
consent + EN 301 549 / WCAG 2.1 AA** — not the Canadian PIPEDA/AODA text. Don't
just translate the CA legal page.

## Compliance (CA, live)
- PIPEDA privacy notice + AODA / WCAG 2.0 AA accessibility statement in
  `ca/privacy.html`, footer-linked.
- Essential-only cookies; no analytics/tracking. Map data © OpenStreetMap.
