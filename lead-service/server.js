/**
 * Greems — lead intake for lp.greems.io/host/
 *
 * A minimal HTTP service whose only purpose is to hold the Pipedrive API
 * token. The landing page is public static HTML, so a token shipped to the
 * browser would be readable by anyone; that token is admin-level on the CRM.
 *
 * For each submission it creates, in order:
 *   1. a Person  (name, email, phone)
 *   2. a Lead    attached to that Person   ← what sales triages
 *   3. a Note    on the Lead with the property type and form language
 *
 * Pipedrive's Leads API requires a person_id or organization_id, which is why
 * the Person is created first rather than stuffing everything onto the Lead.
 *
 * No dependencies: node:http plus the global fetch in Node 18+.
 */

import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.PIPEDRIVE_TOKEN;

const ALLOWED_ORIGINS = new Set([
  "https://lp.greems.io",
  "http://127.0.0.1:8080",
  "http://localhost:8080",
]);

const PLACE_LABELS = {
  camping: "Campground / glamping",
  cabin: "Tzimmer / cabin",
  hotel: "Boutique hotel / guesthouse",
  airbnb: "Airbnb apartment",
  other: "Other",
};

const MAX_BODY_BYTES = 8 * 1024;

/** Crude per-IP throttle. In-process, so it resets when the machine sleeps —
 *  enough to blunt casual abuse, not a substitute for a real WAF. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 6;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

function corsFor(origin) {
  return {
    "access-control-allow-origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://lp.greems.io",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function send(res, status, body, origin) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
    ...corsFor(origin),
  });
  res.end(payload);
}

/** Deliberately permissive: Israeli mobile, landline and +972 international. */
function validate({ name, phone, email, place }) {
  const bad = [];
  if (typeof name !== "string" || name.trim().length < 2) bad.push("name");
  if (typeof phone !== "string" || phone.replace(/\D/g, "").length < 9) bad.push("phone");
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()))
    bad.push("email");
  if (!Object.prototype.hasOwnProperty.call(PLACE_LABELS, place)) bad.push("place");
  return bad;
}

async function pipedrive(path, payload) {
  const res = await fetch(`https://api.pipedrive.com/v1/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // Header rather than ?api_token= so the token stays out of logs and referrers.
      "x-api-token": TOKEN,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    throw new Error(`${path} ${res.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body.data;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsFor(origin));
    res.end();
    return;
  }

  // Fly's health check hits the root with GET.
  if (req.method === "GET") {
    send(res, 200, { ok: true, service: "greems-lead", configured: Boolean(TOKEN) }, origin);
    return;
  }

  if (req.method !== "POST") {
    send(res, 405, { ok: false, error: "method_not_allowed" }, origin);
    return;
  }

  if (!TOKEN) {
    console.error("PIPEDRIVE_TOKEN is not set");
    send(res, 500, { ok: false, error: "not_configured" }, origin);
    return;
  }

  const ip =
    (req.headers["fly-client-ip"] ||
      (req.headers["x-forwarded-for"] || "").split(",")[0] ||
      req.socket.remoteAddress ||
      "unknown").toString().trim();

  if (rateLimited(ip)) {
    send(res, 429, { ok: false, error: "rate_limited" }, origin);
    return;
  }

  let input;
  try {
    input = JSON.parse(await readBody(req));
  } catch {
    send(res, 400, { ok: false, error: "invalid_json" }, origin);
    return;
  }

  // Honeypot: report success so the bot doesn't retry, but store nothing.
  if (typeof input.company === "string" && input.company.trim() !== "") {
    send(res, 200, { ok: true }, origin);
    return;
  }

  const bad = validate(input);
  if (bad.length) {
    send(res, 422, { ok: false, error: "validation", fields: bad }, origin);
    return;
  }

  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const place = input.place;
  const placeLabel = PLACE_LABELS[place];
  const locale = input.locale === "en" ? "en" : "he";

  try {
    const person = await pipedrive("persons", {
      name,
      email: [{ value: email, primary: true }],
      phone: [{ value: phone, primary: true }],
    });

    const lead = await pipedrive("leads", {
      title: `${name} — ${placeLabel}`,
      person_id: person.id,
    });

    // The lead already exists, so a failed note is not worth failing the request.
    try {
      await pipedrive("notes", {
        lead_id: lead.id,
        content:
          `<b>Source:</b> lp.greems.io/host/<br>` +
          `<b>Type of place:</b> ${placeLabel} (${place})<br>` +
          `<b>Phone:</b> ${phone}<br>` +
          `<b>Email:</b> ${email}<br>` +
          `<b>Form language:</b> ${locale}`,
      });
    } catch (noteError) {
      console.error("note failed:", noteError.message);
    }

    console.log(`lead created: person=${person.id} lead=${lead.id} place=${place}`);
    send(res, 200, { ok: true }, origin);
  } catch (error) {
    // Never echo Pipedrive's response to the browser.
    console.error("lead intake failed:", error.message);
    send(res, 502, { ok: false, error: "upstream" }, origin);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`greems-lead listening on ${PORT}, pipedrive ${TOKEN ? "configured" : "NOT configured"}`);
});
