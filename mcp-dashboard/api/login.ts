import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "mcp_session";
const MAX_AGE = 60 * 60 * 24; // 24 hours

function sign(value: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password } = req.body ?? {};
  const expected = process.env.DASHBOARD_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: "DASHBOARD_PASSWORD not configured" });
  }

  if (typeof password !== "string" || password.length === 0) {
    return res.status(400).json({ error: "Password required" });
  }

  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signed = sign(timestamp, expected);

  res.setHeader("Set-Cookie", [
    `${COOKIE_NAME}=${signed}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`,
  ]);

  return res.status(200).json({ ok: true });
}
