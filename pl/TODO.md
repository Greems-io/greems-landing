# Poland (PL) page — TODO before launch

Reuse the CA page structure (`../ca/index.html`) as the template, but EU law
differs from Canada — do NOT just translate the CA legal text.

## Build steps
1. Copy `../ca/index.html` → `pl/index.html`; swap wordmark logo (Greems Polska),
   set `<html lang="pl">`, translate all copy to **Polish**.
2. Bake `pl/locations.json`: `../bake_locations.sh PL pl/locations.json <cloud-run-url>`
   (needs the generalized endpoint `/lp/api/locations?country=PL`).
3. Replace the privacy page with an **EU GDPR** notice (see below).

## Legal — EU, not PIPEDA/AODA
- **GDPR**: privacy notice with controller identity, legal basis, data-subject
  rights (access/erasure/portability/objection), retention, DPO/contact, and
  the right to lodge a complaint with the Polish DPA (UODO).
- **ePrivacy / cookie consent**: consent must be **opt-in** — non-essential
  cookies/trackers blocked until the user actively accepts. The current CA
  banner is notice-only (fine for CA, NOT sufficient for EU). Our page uses only
  essential storage + OSM tiles, so a clear consent banner + honoring "reject"
  is the minimum. Confirm with legal.
- **Accessibility**: target **EN 301 549 / WCAG 2.1 AA** (European Accessibility
  Act). The CA build already meets WCAG 2.0 AA — bump to 2.1 AA.
- Polish-language requirement for consumer-facing content.

Provide the approved Polish legal text (or sign-off) before publishing.
