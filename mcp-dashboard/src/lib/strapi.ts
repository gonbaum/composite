import type { Action, ActionLog, AuthCredential, StrapiResponse } from "@/types";

const STRAPI_URL = import.meta.env.VITE_STRAPI_URL || "http://localhost:1337";
const STRAPI_TOKEN = import.meta.env.VITE_STRAPI_TOKEN;

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (STRAPI_TOKEN) {
    headers["Authorization"] = `Bearer ${STRAPI_TOKEN}`;
  }

  const options: RequestInit = { method, headers };
  if (body && ["POST", "PUT"].includes(method)) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${STRAPI_URL}${path}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }

  return data;
}

// Actions
const ACTION_POPULATE = "populate[parameters]=true&populate[api_config]=true&populate[bash_config]=true&populate[composite_config]=true&populate[auth_credential]=true";

export async function getActions(): Promise<Action[]> {
  const res = await request<StrapiResponse<Action[]>>("GET", `/api/actions?${ACTION_POPULATE}&sort=name:asc`);
  return res.data;
}

export async function getAction(documentId: string): Promise<Action> {
  const res = await request<StrapiResponse<Action>>("GET", `/api/actions/${documentId}?${ACTION_POPULATE}`);
  return res.data;
}

export async function createAction(data: unknown): Promise<Action> {
  const res = await request<StrapiResponse<Action>>("POST", "/api/actions", { data });
  return res.data;
}

export async function updateAction(documentId: string, data: unknown): Promise<Action> {
  const res = await request<StrapiResponse<Action>>("PUT", `/api/actions/${documentId}`, { data });
  return res.data;
}

export async function deleteAction(documentId: string): Promise<void> {
  await request("DELETE", `/api/actions/${documentId}`);
}

export async function executeAction(actionName: string, params: Record<string, unknown>): Promise<unknown> {
  return await request("POST", "/api/actions/execute", { action: actionName, params });
}

// Auth Credentials
export async function getAuthCredentials(): Promise<AuthCredential[]> {
  const res = await request<StrapiResponse<AuthCredential[]>>("GET", "/api/auth-credentials?sort=name:asc");
  return res.data;
}

export async function getAuthCredential(documentId: string): Promise<AuthCredential> {
  const res = await request<StrapiResponse<AuthCredential>>("GET", `/api/auth-credentials/${documentId}`);
  return res.data;
}

export async function createAuthCredential(data: unknown): Promise<AuthCredential> {
  const res = await request<StrapiResponse<AuthCredential>>("POST", "/api/auth-credentials", { data });
  return res.data;
}

export async function updateAuthCredential(documentId: string, data: unknown): Promise<AuthCredential> {
  const res = await request<StrapiResponse<AuthCredential>>("PUT", `/api/auth-credentials/${documentId}`, { data });
  return res.data;
}

export async function deleteAuthCredential(documentId: string): Promise<void> {
  await request("DELETE", `/api/auth-credentials/${documentId}`);
}

// Action Logs
export async function getActionLogs(filters?: {
  action_name?: string;
  success?: boolean;
}): Promise<ActionLog[]> {
  const params = new URLSearchParams({
    "sort": "createdAt:desc",
    "pagination[pageSize]": "50",
  });

  if (filters?.action_name) {
    params.set("filters[action_name][$eq]", filters.action_name);
  }
  if (filters?.success !== undefined) {
    params.set("filters[success][$eq]", String(filters.success));
  }

  const res = await request<StrapiResponse<ActionLog[]>>("GET", `/api/action-logs?${params}`);
  return res.data;
}
