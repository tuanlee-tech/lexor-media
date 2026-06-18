import crypto from 'crypto';
async function hmacSha256(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
}
function base64UrlEncode(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
async function run() {
  const secret = process.env.ADMIN_SESSION_SECRET || "lexor2024";
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    username: "admin",
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const signature = base64UrlEncode(await hmacSha256(secret, `${header}.${payload}`));
  const token = `${header}.${payload}.${signature}`;
  
  const res = await fetch("https://lexor-media-gallery-api.lexortechdev.workers.dev/api/admin/categories", {
    headers: { "X-Admin-Token": token }
  });
  console.log(await res.text());
}
run();
