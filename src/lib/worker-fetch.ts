import * as http from "node:http";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Fetch data from the local worker HTTP server using Node.js `http` module.
 * Next.js standalone's global `fetch` (undici) has known issues with local
 * connections (IPv6 resolution, connection reuse). The native `http` module
 * is more reliable for same-machine server-to-server calls.
 */
export async function workerFetch(path: string): Promise<string> {
  const baseUrl = env.VPS_WORKER_URL;
  if (!baseUrl) return Promise.reject(new Error("VPS_WORKER_URL not set"));
  if (!env.WORKER_API_SECRET)
    return Promise.reject(new Error("WORKER_API_SECRET not set"));

  const url = new URL(path, baseUrl);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 8080,
        path: url.pathname,
        method: "GET",
        timeout: 10_000,
        headers: {
          Authorization: `Bearer ${env.WORKER_API_SECRET}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(
              new Error(
                `Worker returned ${res.statusCode}: ${data.slice(0, 200)}`,
              ),
            );
          }
        });
      },
    );

    req.on("error", (err) => {
      logger.error("[workerFetch] Connection error", {
        path,
        error: String(err),
      });
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Worker request timed out"));
    });

    req.end();
  });
}

export async function workerPost(
  path: string,
  body: Record<string, unknown>,
): Promise<string> {
  const baseUrl = env.VPS_WORKER_URL;
  if (!baseUrl) return Promise.reject(new Error("VPS_WORKER_URL not set"));
  if (!env.WORKER_API_SECRET)
    return Promise.reject(new Error("WORKER_API_SECRET not set"));

  const url = new URL(path, baseUrl);
  const payload = JSON.stringify(body);

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 8080,
        path: url.pathname,
        method: "POST",
        timeout: 10_000,
        headers: {
          Authorization: `Bearer ${env.WORKER_API_SECRET}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(
              new Error(
                `Worker returned ${res.statusCode}: ${data.slice(0, 200)}`,
              ),
            );
          }
        });
      },
    );

    req.on("error", (err) => {
      logger.error("[workerPost] Connection error", {
        path,
        error: String(err),
      });
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Worker request timed out"));
    });

    req.end(payload);
  });
}
