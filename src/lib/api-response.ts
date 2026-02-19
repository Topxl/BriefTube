/**
 * Shared API error type — all API routes return { error: string } on failure.
 */
export type ApiErrorBody = { error: string };

/**
 * Type guard — returns true if the value looks like an API error body.
 */
export function isApiError(v: unknown): v is ApiErrorBody {
  return (
    typeof v === "object" &&
    v !== null &&
    "error" in v &&
    typeof (v as Record<string, unknown>).error === "string"
  );
}

/**
 * Typed fetch wrapper that throws on non-2xx responses or `{ error }` bodies.
 * Use this for client-side calls to Next.js API routes.
 *
 * @example
 * const data = await fetchApi<{ id: string }>("/api/subscriptions", {
 *   method: "POST",
 *   body: JSON.stringify({ channelId }),
 *   headers: { "Content-Type": "application/json" },
 * });
 */
export async function fetchApi<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, options);
  const data: unknown = await response.json();

  if (!response.ok || isApiError(data)) {
    const message = isApiError(data) ? data.error : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}
