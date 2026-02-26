import type { Action, ActionLog, AuthCredential, StrapiResponse } from "@/types";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const options: RequestInit = { method, headers };
  if (body && ["POST", "PUT"].includes(method)) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`/api/strapi${path}`, options);

  if (res.status === 401) {
    window.location.reload();
    throw new Error("Session expired");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`);
  }

  return data;
}

// Actions
const ACTION_POPULATE = "populate[parameters]=true&populate[api_config]=true&populate[bash_config]=true&populate[composite_config]=true&populate[auth_credential]=true";

export async function getActions(): Promise<Action[]> {
  const res = await request<StrapiResponse<Action[]>>("GET", `/actions?${ACTION_POPULATE}&sort=name:asc`);
  return res.data;
}

export async function getAction(documentId: string): Promise<Action> {
  const res = await request<StrapiResponse<Action>>("GET", `/actions/${documentId}?${ACTION_POPULATE}`);
  return res.data;
}

export async function createAction(data: unknown): Promise<Action> {
  const res = await request<StrapiResponse<Action>>("POST", "/actions", { data });
  return res.data;
}

export async function updateAction(documentId: string, data: unknown): Promise<Action> {
  const res = await request<StrapiResponse<Action>>("PUT", `/actions/${documentId}`, { data });
  return res.data;
}

export async function deleteAction(documentId: string): Promise<void> {
  await request("DELETE", `/actions/${documentId}`);
}

export async function executeAction(actionName: string, params: Record<string, unknown>): Promise<unknown> {
  return await request("POST", "/actions/execute", { action: actionName, params, source: "dashboard" });
}

// Auth Credentials
export async function getAuthCredentials(): Promise<AuthCredential[]> {
  const res = await request<StrapiResponse<AuthCredential[]>>("GET", "/auth-credentials?sort=name:asc");
  return res.data;
}

export async function getAuthCredential(documentId: string): Promise<AuthCredential> {
  const res = await request<StrapiResponse<AuthCredential>>("GET", `/auth-credentials/${documentId}`);
  return res.data;
}

export async function createAuthCredential(data: unknown): Promise<AuthCredential> {
  const res = await request<StrapiResponse<AuthCredential>>("POST", "/auth-credentials", { data });
  return res.data;
}

export async function updateAuthCredential(documentId: string, data: unknown): Promise<AuthCredential> {
  const res = await request<StrapiResponse<AuthCredential>>("PUT", `/auth-credentials/${documentId}`, { data });
  return res.data;
}

export async function deleteAuthCredential(documentId: string): Promise<void> {
  await request("DELETE", `/auth-credentials/${documentId}`);
}

// Action Logs
export async function getActionLogs(filters?: {
  action_name?: string;
  success?: boolean;
  source?: string;
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
  if (filters?.source) {
    params.set("filters[source][$eq]", filters.source);
  }

  const res = await request<StrapiResponse<ActionLog[]>>("GET", `/action-logs?${params}`);
  return res.data;
}
