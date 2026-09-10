import { put } from "@vercel/blob";
import { requireAuth, blobReady } from "./_auth.js";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

const SAFE = /^[a-z0-9][a-z0-9-]{0,60}$/;

/**
 * POST /api/upload  { name, dataUrl }  →  { url }
 *
 * Stores one photograph in Blob storage and hands back its public URL.
 * The Studio has already resized and compressed the picture in the browser,
 * so what arrives here is a web-sized JPEG.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!requireAuth(req, res)) return;
  if (!blobReady(res)) return;

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const name = String(body.name || "painting").toLowerCase();
  const dataUrl = String(body.dataUrl || "");

  if (!SAFE.test(name)) {
    return res.status(400).json({ error: "name", message: "That file name cannot be used." });
  }
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) {
    return res.status(400).json({ error: "image", message: "That photograph could not be read." });
  }

  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > 6 * 1024 * 1024) {
    return res.status(413).json({ error: "large", message: "That photograph is too large." });
  }

  try {
    const blob = await put(`art/${Date.now()}-${name}.${ext}`, bytes, {
      access: "public",
      contentType: `image/${m[1]}`,
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000
    });
    return res.status(200).json({ url: blob.url, pathname: blob.pathname });
  } catch (err) {
    return res.status(500).json({ error: "blob", message: "The photograph could not be stored: " + err.message });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
