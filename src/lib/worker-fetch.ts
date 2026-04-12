import { execSync } from "child_process";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Fetch data from the local worker HTTP server using curl via child_process.
 *
 * Neither global fetch (undici) nor node:http work reliably inside
 * Next.js Turbopack standalone builds for localhost connections.
 * curl is guaranteed to work -- tested and confirmed on the VPS.
 */
export async function workerFetch(path: string): Promise<string> {
  const baseUrl = env.VPS_WORKER_URL;
  if (!baseUrl) return Promise.reject(new Error("VPS_WORKER_URL not set"));
  if (!env.WORKER_API_SECRET)
    return Promise.reject(new Error("WORKER_API_SECRET not set"));

  const url = `${baseUrl}${path}`;

  try {
    const result = execSync(
      `curl -sf --max-time 10 -H 'Authorization: Bearer ${env.WORKER_API_SECRET}' '${url}'`,
      { timeout: 12_000, encoding: "utf-8" },
    );
    return Promise.resolve(result);
  } catch (err) {
    logger.error("[workerFetch] curl failed", { path, error: String(err) });
    return Promise.reject(
      new Error(`Worker unreachable at ${url}: ${String(err)}`),
    );
  }
}

export async function workerPost(
  path: string,
  body: Record<string, unknown>,
): Promise<string> {
  const baseUrl = env.VPS_WORKER_URL;
  if (!baseUrl) return Promise.reject(new Error("VPS_WORKER_URL not set"));
  if (!env.WORKER_API_SECRET)
    return Promise.reject(new Error("WORKER_API_SECRET not set"));

  const url = `${baseUrl}${path}`;
  const payload = JSON.stringify(body);

  try {
    const result = execSync(
      `curl -sf --max-time 10 -X POST -H 'Authorization: Bearer ${env.WORKER_API_SECRET}' -H 'Content-Type: application/json' -d '${payload}' '${url}'`,
      { timeout: 12_000, encoding: "utf-8" },
    );
    return Promise.resolve(result);
  } catch (err) {
    logger.error("[workerPost] curl failed", { path, error: String(err) });
    return Promise.reject(
      new Error(`Worker unreachable at ${url}: ${String(err)}`),
    );
  }
}
