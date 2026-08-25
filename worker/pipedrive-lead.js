/**
 * Greems — lead intake for lp.greems.io/host/
 *
 * Cloudflare Worker sitting between the static landing page and Pipedrive.
 * It exists for one reason: the Pipedrive API token must never reach the
 * browser. Anything in client-side JavaScript is public, and that token grants
 * full read/write access to the CRM.
 *
 * For each submission it creates, in order:
 *   1. a Person   (name, email, phone)
 *   2. a Lead     attached to that Person   ← what sales triages
 *   3. a Note     on the Lead, recording the property type and locale
 *
 * Pipedrive's Leads API requires a person_id or organization_id, which is why
 * the Person comes first rather than stuffing everything into the Lead.
 *
 * ── Deploy ────────────────────────────────────────────────────────────────
 *   npm i -g wrangler
 *   wrangler login
 *   wrangler deploy                       # uses wrangler.toml beside this file
 *   wrangler secret put PIPEDRIVE_TOKEN   # paste the token when prompted
 *
 * Then put the resulting https://<name>.<subdomain>.workers.dev URL into
 * LEAD_ENDPOINT in host/index.html.
 *
 * The token is stored as a Worker secret. It is never committed to this repo
 * and never sent to the client.
 */

const ALLOWED_ORIGINS = [
  "https://lp.greems.io",
  "http://127.0.0.1:8080", // local testing; harmless to leave
];

const PLACE_LABELS = {
  camping: "Campground / glamping",
  cabin: "Tzimmer / cabin",
  hotel: "Boutique hotel / guesthouse",
  airbnb: "Airbnb apartment",
  other: "Other",
};

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/** Deliberately permissive — Israeli mobile, landline and +972 international. */
function validate({ name, phone, email, place }) {
  const errors = [];
  if (!name || name.trim().length < 2) errors.push("name");
  if (!phone || phone.replace(/\D/g, "").length < 9) errors.push("phone");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) errors.push("email");
  if (!place || !Object.prototype.hasOwnProperty.call(PLACE_LABELS, place)) errors.push("place");
  return errors;
}

async function pipedrive(path, token, payload) {
  const res = await fetch(`https://api.pipedrive.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Personal API token. The alternative ?api_token= query form also works,
      // but a header keeps it out of logs and referrers.
      "x-api-token": token,
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(`pipedrive ${path} ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body.data;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, 405, origin);
    }
    if (!env.PIPEDRIVE_TOKEN) {
      console.error("PIPEDRIVE_TOKEN is not set");
      return json({ ok: false, error: "not_configured" }, 500, origin);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400, origin);
    }

    // Honeypot. Report success so the bot does not retry, but store nothing.
    if (typeof input.company === "string" && input.company.trim() !== "") {
      return json({ ok: true }, 200, origin);
    }

    const errors = validate(input);
    if (errors.length) {
      return json({ ok: false, error: "validation", fields: errors }, 422, origin);
    }

    const name = input.name.trim();
    const email = input.email.trim();
    const phone = input.phone.trim();
    const place = input.place;
    const placeLabel = PLACE_LABELS[place];
    const locale = input.locale === "en" ? "en" : "he";

    try {
      const person = await pipedrive("persons", env.PIPEDRIVE_TOKEN, {
        name,
        email: [{ value: email, primary: true }],
        phone: [{ value: phone, primary: true }],
      });

      const lead = await pipedrive("leads", env.PIPEDRIVE_TOKEN, {
        title: `${name} — ${placeLabel}`,
        person_id: person.id,
      });

      // Best effort: the lead already exists, so a failed note is not fatal.
      try {
        await pipedrive("notes", env.PIPEDRIVE_TOKEN, {
          lead_id: lead.id,
          content:
            `<b>Source:</b> lp.greems.io/host/<br>` +
            `<b>Type of place:</b> ${placeLabel} (${place})<br>` +
            `<b>Phone:</b> ${phone}<br>` +
            `<b>Email:</b> ${email}<br>` +
            `<b>Form language:</b> ${locale}`,
        });
      } catch (noteError) {
        console.error("note failed", noteError.message);
      }

      return json({ ok: true }, 200, origin);
    } catch (error) {
      // Never echo Pipedrive's response to the browser.
      console.error("lead intake failed", error.message);
      return json({ ok: false, error: "upstream" }, 502, origin);
    }
  },
};
