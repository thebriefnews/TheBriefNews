/* GET/POST /api/seen
   Counts how many DISTINCT people have opened the secret page.
   Identity = the visitor's IP (from Cloudflare's CF-Connecting-IP header),
   stored only as a SHA-256 hash so no raw IP is kept. The same IP writing
   again just overwrites the same key, so opens by the same person don't add up.

   Needs a KV namespace bound to this Pages project as  DATA  (see README).
   If the binding is missing, returns 503 and the app hides the counter. */

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DATA) return json({ count: null }, 503);
  try {
    const ip = request.headers.get("CF-Connecting-IP") || "0.0.0.0";
    const hash = await sha256("briefing-v1|" + ip);
    await env.DATA.put("seen:" + hash, "1");   // idempotent per person

    let count = 0, cursor, done = false, guard = 0;
    while (!done && guard++ < 25) {
      const r = await env.DATA.list({ prefix: "seen:", cursor });
      count += r.keys.length;
      done = r.list_complete;
      cursor = r.cursor;
    }
    return json({ count });
  } catch (e) {
    return json({ count: null }, 500);
  }
}

async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
