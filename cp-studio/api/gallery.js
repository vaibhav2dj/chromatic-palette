import { list } from "@vercel/blob";

const FILE = "gallery.json";

/**
 * GET /api/gallery → the wall's contents.
 *
 * Reads gallery.json from Blob storage. Before the first publish there is
 * nothing there, so it falls back to data.json shipped with the site — which
 * is how the original paintings keep showing without a migration step.
 */
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "method" });

  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { blobs } = await list({ prefix: FILE, limit: 1 });
      const hit = blobs.find(b => b.pathname === FILE);
      if (hit) {
        const r = await fetch(hit.url + "?t=" + Date.now(), { cache: "no-store" });
        if (r.ok) {
          const data = await r.json();
          return res.status(200).json({ ...data, source: "blob" });
        }
      }
    }
  } catch (err) {
    // fall through to the seed rather than showing an empty wall
  }

  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || (/^localhost|^127\./.test(host) ? "http" : "https");
    const r = await fetch(`${proto}://${host}/data.json`, { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      return res.status(200).json({ ...data, source: "seed" });
    }
  } catch (err) {
    // fall through
  }

  return res.status(200).json({ artist: {}, works: [], source: "empty" });
}
