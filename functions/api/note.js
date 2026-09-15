/* GET  /api/note  -> returns the stored note JSON, or null
   PUT  /api/note  -> stores the note JSON (already encrypted by the browser)

   The body is opaque to the server: it's the {salt,iv,ct} blob the page made,
   so the plaintext never leaves the phone. Needs the same KV binding  DATA .
   Missing binding -> 503, and the app keeps the note on that device only. */

export async function onRequest(context) {
  const { request, env } = context;
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  if (!env.DATA) return new Response(JSON.stringify({ error: "no-store" }), { status: 503, headers });

  try {
    if (request.method === "PUT" || request.method === "POST") {
      const body = await request.text();
      if (body.length > 20000) return new Response(JSON.stringify({ ok: false }), { status: 413, headers });
      await env.DATA.put("note", body);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    }
    const v = await env.DATA.get("note");
    return new Response(v || "null", { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers });
  }
}
