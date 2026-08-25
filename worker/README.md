# Lead intake Worker

Sits between `lp.greems.io/host/` and Pipedrive. Its only job is to hold the
Pipedrive API token, which must never be in the page — client-side JavaScript is
public, and that token grants full read/write access to the CRM.

Each submission creates a **Person**, a **Lead** attached to it, and a **Note**
recording the property type. Pipedrive's Leads API requires a `person_id` or
`organization_id`, which is why the Person is created first.

## Deploy

```bash
npm i -g wrangler
wrangler login                          # opens a browser
cd worker
wrangler deploy
wrangler secret put PIPEDRIVE_TOKEN     # paste the token when prompted
```

Get the token from Pipedrive: **Personal preferences → API → Your personal API
token**. Prefer a token belonging to a service/automation user rather than a
person's own login.

Then take the deployed URL (`https://greems-lead.<subdomain>.workers.dev`) and
set it as `LEAD_ENDPOINT` in `host/index.html`. Until that constant is filled in,
the form validates normally but shows its error state instead of submitting.

## Verify

```bash
curl -i -X POST https://greems-lead.<subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://lp.greems.io' \
  -d '{"name":"בדיקה","phone":"0500000000","email":"test@example.com","place":"cabin","locale":"he"}'
```

Expect `{"ok":true}` and a new Lead in Pipedrive. Delete the test lead afterwards.

Failure modes, all of which return a generic error to the browser and log the
detail to `wrangler tail`:

| Response | Meaning |
| --- | --- |
| `422 validation` | a field failed the server-side check |
| `500 not_configured` | `PIPEDRIVE_TOKEN` secret is missing |
| `502 upstream` | Pipedrive rejected the call — check `wrangler tail` |

## Notes

- CORS is restricted to `https://lp.greems.io` (plus localhost for testing) in
  `ALLOWED_ORIGINS`. Add any staging host there.
- The honeypot field returns `{"ok":true}` without storing anything, so bots
  don't retry.
- Pipedrive errors are logged, never echoed to the client.
