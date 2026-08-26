# Lead intake service

Receives submissions from the form on `lp.greems.io/host/` and creates a
**Person**, a **Lead**, and a **Note** in Pipedrive.

It exists for one reason: the Pipedrive API token must not be in the landing
page. That page is public static HTML, so anything in it is readable by anyone,
and the token is admin-level on the CRM.

No dependencies — `node:http` and the global `fetch`.

## Deploy

```bash
export FLY_API_TOKEN=<deploy token>
fly deploy                                  # from this directory
fly secrets set PIPEDRIVE_TOKEN=<token>     # triggers a restart
```

Then set the resulting URL as `LEAD_ENDPOINT` in `host/index.html`.

The app scales to zero (`min_machines_running = 0`), so it costs nothing while
idle and cold-starts in about a second on the first submission.

## Check it

```bash
curl https://greems-lead.fly.dev/                       # {"ok":true,"configured":true}

curl -sS -X POST https://greems-lead.fly.dev/ \
  -H 'content-type: application/json' \
  -H 'origin: https://lp.greems.io' \
  -d '{"name":"בדיקה","phone":"0500000000","email":"test@example.com","place":"cabin","locale":"he"}'
```

Expect `{"ok":true}` and a new Lead in Pipedrive. Delete the test record after.

`fly logs` shows one line per lead (`lead created: person=… lead=… place=…`).

| Response | Meaning |
| --- | --- |
| `422 validation` | a field failed the server-side check; `fields` says which |
| `429 rate_limited` | more than 6 posts from one IP in a minute |
| `500 not_configured` | `PIPEDRIVE_TOKEN` secret missing |
| `502 upstream` | Pipedrive rejected the call — see `fly logs` |

## Notes

- CORS is limited to `https://lp.greems.io` plus localhost. Add staging hosts to
  `ALLOWED_ORIGINS` in `server.js`.
- The honeypot field returns `{"ok":true}` without storing anything.
- Pipedrive errors are logged, never returned to the browser.
- Rotate the token with `fly secrets set PIPEDRIVE_TOKEN=<new>`; no redeploy needed.
