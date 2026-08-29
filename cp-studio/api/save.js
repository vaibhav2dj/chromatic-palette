import { put } from "@vercel/blob";
import { requireAuth, blobReady } from "./_auth.js";

export const config = { api: { bodyParser: { sizeLimit: "4mb" } } };

const FILE = "gallery.json";

/**
 * POST /api/save  { artist, works }  →  { saved: true }
 *
 * Writes the wall to Blob storage. This is what the public page reads, so a
 * save takes effect immediately — no rebuild, no repository, no waiting.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!requireAuth(req, res)) return;
  if (!blobReady(res)) return;

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (!body || typeof body !== "object" || !Array.isArray(body.works)) {
    return res.status(400).json({ error: "shape", message: "The gallery could not be read." });
  }

  const clean = {
    artist: pickArtist(body.artist || {}),
    works: body.works.slice(0, 500).map(pickWork).filter(w => w.img),
    updated: new Date().toISOString()
  };

  try {
    await put(FILE, JSON.stringify(clean, null, 1), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0
    });
    return res.status(200).json({ saved: true, works: clean.works.length });
  } catch (err) {
    return res.status(500).json({ error: "blob", message: "The wall could not be saved: " + err.message });
  }
}

const str = (v, max) => String(v == null ? "" : v).slice(0, max);

function pickArtist(a) {
  return {
    name: str(a.name, 120),
    tagline: str(a.tagline, 200),
    bio: str(a.bio, 4000),
    portrait: str(a.portrait, 500),
    email: str(a.email, 200),
    phone: str(a.phone, 60),
    instagram: str(a.instagram, 80)
  };
}

function pickWork(w) {
  const status = ["display", "available", "sold"].includes(w.status) ? w.status : "display";
  const out = {
    img: str(w.img, 500),
    title: str(w.title, 200),
    medium: str(w.medium, 120),
    size: str(w.size, 80),
    year: str(w.year, 20),
    note: str(w.note, 2000),
    status
  };
  if (Number(w.w) > 0 && Number(w.h) > 0) { out.w = Math.round(Number(w.w)); out.h = Math.round(Number(w.h)); }
  return out;
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return null; }
}
