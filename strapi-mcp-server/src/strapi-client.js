const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;

export async function strapiRequest(method, path, body = null) {
  const url = `${STRAPI_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
  };

  if (STRAPI_TOKEN) {
    headers["Authorization"] = `Bearer ${STRAPI_TOKEN}`;
  }

  const options = { method, headers };

  if (body && ["POST", "PUT"].includes(method)) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Strapi ${method} ${path} failed (${response.status}): ${JSON.stringify(data)}`
    );
  }

  return data;
}
