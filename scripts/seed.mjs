#!/usr/bin/env node

/**
 * Seed script for Strapi — creates the standard demo actions.
 *
 * Usage:
 *   STRAPI_URL=https://your-instance.strapiapp.com STRAPI_TOKEN=xxx node scripts/seed.mjs
 *
 * Or with flags:
 *   node scripts/seed.mjs --url https://your-instance.strapiapp.com --token xxx
 *
 * Add --clean to delete all existing actions/credentials before seeding.
 */

const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return undefined;
  return args[i + 1];
}

const STRAPI_URL = (flag("url") || process.env.STRAPI_URL || "http://localhost:1337").replace(/\/$/, "");
const STRAPI_TOKEN = flag("token") || process.env.STRAPI_TOKEN;
const CLEAN = args.includes("--clean");

if (!STRAPI_TOKEN) {
  console.error("Missing STRAPI_TOKEN. Pass via env var or --token flag.");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${STRAPI_URL}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data?.error || data)}`);
  }
  return data;
}

// --- Seed data (same actions as seed.sh) ---

const actions = [
  {
    name: "get_weather",
    display_name: "Get Weather",
    description: "Get the current weather for a city. Returns temperature in Celsius, weather condition, humidity, and wind speed.",
    action_type: "api",
    enabled: true,
    tags: ["weather", "utility"],
    parameters: [
      {
        name: "city",
        type: "string",
        description: "City name, e.g. Paris, Tokyo, New York",
        required: true,
      },
    ],
    api_config: {
      method: "GET",
      url_template: "https://wttr.in/{{city}}?format=j1",
      headers: {},
      timeout_ms: 30000,
    },
  },
  {
    name: "get_dad_joke",
    display_name: "Get Dad Joke",
    description: "Get a random dad joke. No parameters needed.",
    action_type: "api",
    enabled: true,
    tags: ["fun"],
    parameters: [],
    api_config: {
      method: "GET",
      url_template: "https://icanhazdadjoke.com/",
      headers: { Accept: "application/json" },
      timeout_ms: 30000,
    },
  },
  {
    name: "get_cat_fact",
    display_name: "Get Cat Fact",
    description: "Get a random cat fact.",
    action_type: "api",
    enabled: true,
    tags: ["fun"],
    parameters: [],
    api_config: {
      method: "GET",
      url_template: "https://catfact.ninja/fact",
      headers: {},
      timeout_ms: 10000,
    },
  },
  {
    name: "get_random_image",
    display_name: "Get Random Image",
    description: "Get a random image URL from picsum.photos with optional dimensions.",
    action_type: "api",
    enabled: true,
    tags: ["fun", "utility"],
    parameters: [
      {
        name: "width",
        type: "number",
        description: "Image width in pixels",
        required: false,
        default_value: "400",
      },
      {
        name: "height",
        type: "number",
        description: "Image height in pixels",
        required: false,
        default_value: "300",
      },
    ],
    api_config: {
      method: "GET",
      url_template: "https://picsum.photos/{{width}}/{{height}}",
      headers: {},
      timeout_ms: 10000,
    },
  },
  {
    name: "disk_usage",
    display_name: "Disk Usage",
    description: "Check disk usage for a given path. Returns human-readable disk usage summary.",
    action_type: "bash",
    enabled: true,
    tags: ["system", "utility"],
    parameters: [
      {
        name: "path",
        type: "string",
        description: "Path to check disk usage for, e.g. / or /home",
        required: false,
        default_value: ".",
      },
    ],
    bash_config: {
      command_template: "du -sh {{path}}",
      timeout_ms: 10000,
      allowed_commands: ["du"],
    },
  },
];

// --- Clean ---

async function clean() {
  console.log("Cleaning existing data...");

  const { data: existingActions } = await api("GET", "/actions?pagination[pageSize]=100");
  for (const action of existingActions) {
    await api("DELETE", `/actions/${action.documentId}`);
    console.log(`  Deleted action: ${action.name}`);
  }

  const { data: existingCreds } = await api("GET", "/auth-credentials?pagination[pageSize]=100");
  for (const cred of existingCreds) {
    await api("DELETE", `/auth-credentials/${cred.documentId}`);
    console.log(`  Deleted credential: ${cred.name}`);
  }

  console.log("");
}

// --- Seed ---

async function seed() {
  console.log(`Seeding ${STRAPI_URL}...\n`);

  if (CLEAN) await clean();

  for (const action of actions) {
    const { data } = await api("POST", "/actions", { data: action });
    console.log(`Created action: ${action.display_name} (${data.documentId})`);
  }

  console.log(`\nDone! Created ${actions.length} actions.`);
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
