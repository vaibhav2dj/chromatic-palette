import { makeCookie, clearCookie, isSignedIn, sameSecret } from "./_auth.js";

/**
 * POST /api/login   { password }        → sets the session cookie
 * GET  /api/login                        → { signedIn: boolean }
 * DELETE /api/login                      → signs out
 *
 * The password itself is never stored or returned; it lives only in the
 * project's STUDIO_PASSWORD environment variable.
 */
export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      signedIn: isSignedIn(req),
      configured: !!process.env.STUDIO_PASSWORD && !!process.env.BLOB_READ_WRITE_TOKEN
    });
  }

  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", clearCookie());
    return res.status(200).json({ signedIn: false });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method" });
  }

  const expected = process.env.STUDIO_PASSWORD;
  if (!expected) {
    return res.status(500).json({
      error: "setup",
      message: "No Studio password is set on this project yet."
    });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const given = (body.password || "").trim();
  if (!given) return res.status(400).json({ error: "empty", message: "Enter the password." });

  // Small delay blunts brute forcing without hurting a real sign-in.
  await new Promise(r => setTimeout(r, 400));

  if (!sameSecret(given, expected)) {
    return res.status(401).json({ error: "wrong", message: "That password does not match." });
  }

  res.setHeader("Set-Cookie", makeCookie());
  return res.status(200).json({ signedIn: true });
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
