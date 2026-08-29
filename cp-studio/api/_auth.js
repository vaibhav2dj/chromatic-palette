import crypto from "node:crypto";

const COOKIE = "cp_session";
const DAYS = 30;

function secret() {
  const pw = process.env.STUDIO_PASSWORD;
  if (!pw) throw Object.assign(new Error("STUDIO_PASSWORD is not set"), { code: "no_password" });
  return pw;
}

function sign(expiry) {
  return crypto.createHmac("sha256", secret()).update(String(expiry)).digest("hex");
}

/** Constant-time compare that never throws on length mismatch. */
export function sameSecret(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

export function makeCookie() {
  const expiry = Date.now() + DAYS * 24 * 60 * 60 * 1000;
  const value = `${expiry}.${sign(expiry)}`;
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${DAYS * 24 * 60 * 60}`;
}

export function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

/** True when the request carries a valid, unexpired session cookie. */
export function isSignedIn(req) {
  try {
    const raw = req.headers.cookie || "";
    const hit = raw.split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="));
    if (!hit) return false;
    const [expiry, mac] = decodeURIComponent(hit.slice(COOKIE.length + 1)).split(".");
    if (!expiry || !mac) return false;
    if (Number(expiry) < Date.now()) return false;
    return sameSecret(mac, sign(expiry));
  } catch {
    return false;
  }
}

/** Guard for the write endpoints. Returns true when the caller may proceed. */
export function requireAuth(req, res) {
  if (!process.env.STUDIO_PASSWORD) {
    res.status(500).json({ error: "setup", message: "STUDIO_PASSWORD is not set on this project yet." });
    return false;
  }
  if (!isSignedIn(req)) {
    res.status(401).json({ error: "auth", message: "Please sign in to the Studio again." });
    return false;
  }
  return true;
}

export function blobReady(res) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    res.status(500).json({ error: "setup", message: "The Blob store is not connected to this project yet." });
    return false;
  }
  return true;
}
