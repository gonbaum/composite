import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE_NAME = "mcp_session";
const MAX_AGE = 60 * 60 * 24; // 24 hours

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) cookies[key] = rest.join("=");
  }
  return cookies;
}

function verifySession(cookie: string | undefined, secret: string): boolean {
  if (!cookie) return false;
  const dotIndex = cookie.lastIndexOf(".");
  if (dotIndex === -1) return false;

  const timestamp = cookie.slice(0, dotIndex);
  const providedHmac = cookie.slice(dotIndex + 1);

  const expectedHmac = createHmac("sha256", secret).update(timestamp).digest("hex");

  const a = Buffer.from(providedHmac);
  const b = Buffer.from(expectedHmac);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (isNaN(age) || age < 0 || age > MAX_AGE) return false;

  return true;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.DASHBOARD_PASSWORD;
  const strapiUrl = process.env.STRAPI_URL;
  const strapiToken = process.env.STRAPI_TOKEN;

  if (!secret || !strapiUrl || !strapiToken) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const cookies = parseCookies(req.headers.cookie);
  if (!verifySession(cookies[COOKIE_NAME], secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Build the target URL
  const pathSegments = req.query.path;
  const path = Array.isArray(pathSegments) ? pathSegments.join("/") : pathSegments || "";

  // Rebuild query string excluding the catch-all "path" param
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path") continue;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (value !== undefined) {
      params.append(key, value);
    }
  }
  const qs = params.toString();
  const targetUrl = `${strapiUrl}/api/${path}${qs ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${strapiToken}`,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method: req.method || "GET",
    headers,
  };

  if (req.body && ["POST", "PUT", "PATCH"].includes(req.method || "")) {
    fetchOptions.body = JSON.stringify(req.body);
  }

  const upstream = await fetch(targetUrl, fetchOptions);

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await upstream.text();
    console.error(`Strapi non-JSON response (${upstream.status}) from ${targetUrl}:`, text.slice(0, 200));
    return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}`, detail: text.slice(0, 200) });
  }

  const data = await upstream.json();
  return res.status(upstream.status).json(data);
}
