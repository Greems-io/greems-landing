# Belgium (BE) page — TODO before launch

Reuse the CA page structure (`../ca/index.html`) as the template. Language = EN
(per Greems `COUNTRY_LANG` BE→en), but EU law applies — not PIPEDA/AODA.

## Build steps
1. Copy `../ca/index.html` → `be/index.html`; swap wordmark logo (Greems Belgium).
2. Bake `be/locations.json`: `../bake_locations.sh BE be/locations.json <cloud-run-url>`
   (needs generalized endpoint `/lp/api/locations?country=BE`).
3. Replace privacy page with an **EU GDPR** notice.

## Legal — EU
- **GDPR**: full notice (controller, legal basis, rights, retention, contact,
  right to complain to the Belgian DPA — APD/GBA).
- **ePrivacy / cookie consent**: **opt-in** consent for non-essential cookies
  (CA notice-only banner is NOT sufficient for EU).
- **Accessibility**: EN 301 549 / WCAG 2.1 AA (European Accessibility Act).
- Belgium is multilingual — confirm whether NL/FR versions are also required for
  the target audience.

Provide approved legal text (or sign-off) before publishing.
