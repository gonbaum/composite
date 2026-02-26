import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Set-Cookie", [
    "mcp_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
  ]);

  return res.status(200).json({ ok: true });
}
