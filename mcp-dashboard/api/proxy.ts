import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const strapiUrl = process.env.STRAPI_URL;
  const strapiToken = process.env.STRAPI_TOKEN;

  if (!strapiUrl || !strapiToken) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Vercel rewrite passes :path* as query param "path"
  // e.g. /api/strapi/actions/abc123?populate[x]=true -> /api/proxy?path=actions/abc123&populate[x]=true
  const pathParam = req.query.path;
  const path = Array.isArray(pathParam) ? pathParam.join("/") : pathParam || "";

  // Build query string from raw URL, stripping the injected "path" param
  // and decoding brackets so Strapi gets populate[parameters] not populate%5Bparameters%5D
  const rawQs = (req.url || "").split("?")[1] || "";
  const cleanQs = decodeURIComponent(rawQs)
    .split("&")
    .filter((p) => p !== "" && !p.startsWith("path="))
    .join("&");
  const targetUrl = `${strapiUrl}/api/${path}${cleanQs ? `?${cleanQs}` : ""}`;

  console.log(JSON.stringify({
    tag: "PROXY_DEBUG",
    method: req.method,
    reqUrl: req.url,
    path,
    cleanQs,
    targetUrl,
  }));

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
