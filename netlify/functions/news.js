/* Netlify Function — fetches Google News RSS server-side and returns clean JSON.
   netlify.toml maps /api/news -> this function, so the app finds it automatically.
   Deploy: connect your repo to Netlify (free). Nothing else to set. */

export async function handler(event) {
  const city = ((event.queryStringParameters && event.queryStringParameters.city) || "London").slice(0, 60);
  const feeds = [
    `https://news.google.com/rss/headlines/section/geo/${encodeURIComponent(city)}?hl=en-GB&gl=GB&ceid=GB:en`,
    `https://news.google.com/rss/search?q=${encodeURIComponent(city + " news")}&hl=en-GB&gl=GB&ceid=GB:en`,
    `https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en`,
  ];
  const headers = { "content-type": "application/json", "cache-control": "no-store" };
  for (const f of feeds) {
    try {
      const r = await fetch(f, { headers: { "user-agent": "Mozilla/5.0 (compatible; Briefing/1.0)" } });
      if (!r.ok) continue;
      const items = parseItems(await r.text());
      if (items.length) return { statusCode: 200, headers, body: JSON.stringify({ items }) };
    } catch (e) { /* try next feed */ }
  }
  return { statusCode: 502, headers, body: JSON.stringify({ items: [] }) };
}

function clean(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&apos;/g, "'")
          .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          .replace(/&nbsp;/g, " ").trim();
}

function parseItems(xml) {
  const items = [];
  const blocks = xml.split(/<item>/i).slice(1);
  for (const b of blocks) {
    const seg = b.split(/<\/item>/i)[0];
    const pick = (tag) => {
      const m = seg.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">", "i"));
      return m ? clean(m[1]) : "";
    };
    let title = pick("title");
    const link = pick("link");
    const pubDate = pick("pubDate");
    let source = pick("source");
    if (source && title.endsWith(" - " + source)) title = title.slice(0, -(source.length + 3));
    else if (!source && title.lastIndexOf(" - ") > -1) {
      source = title.slice(title.lastIndexOf(" - ") + 3);
      title = title.slice(0, title.lastIndexOf(" - "));
    }
    if (title) items.push({ title, link, pubDate, source: source || "News" });
  }
  return items.slice(0, 14);
}
