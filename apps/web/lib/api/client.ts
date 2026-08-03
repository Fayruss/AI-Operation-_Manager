"use client";

/**
 * Typed fetch wrapper for `/api/v1/*` from Client Components (SAD §6.4:
 * TanStack Query owns all client-side server-state fetching/mutation).
 * Server Components should call the repository layer directly instead of
 * round-tripping through this — see lib/repositories/*.
 */
export interface ApiErrorPayload {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error.message);
    this.code = payload.error.code;
    this.status = status;
    this.details = payload.error.details;
    this.name = "ApiClientError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as T | ApiErrorPayload;

  if (!response.ok) {
    throw new ApiClientError(response.status, payload as ApiErrorPayload);
  }

  return payload as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown, idempotencyKey?: string) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined
    }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" })
};
