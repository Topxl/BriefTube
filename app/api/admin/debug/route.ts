import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import * as http from "node:http";
import * as net from "node:net";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

export async function GET() {
  const debug: Record<string, unknown> = {};

  try {
    const user = await getUser();
    debug.userId = user?.id ?? null;
    debug.isAdmin = !!env.ADMIN_USER_ID && user?.id === env.ADMIN_USER_ID;
  } catch (e) {
    debug.authError = String(e);
  }

  if (!debug.isAdmin) return NextResponse.json(debug);

  // Test 1: raw TCP connection to 127.0.0.1:8080
  debug.test1_tcp = await new Promise<string>((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.connect(8080, "127.0.0.1", () => {
      sock.destroy();
      resolve("CONNECTED");
    });
    sock.on("error", (e) => {
      sock.destroy();
      resolve(`TCP_ERROR: ${e.message}`);
    });
    sock.on("timeout", () => {
      sock.destroy();
      resolve("TCP_TIMEOUT");
    });
  });

  // Test 2: node:http request (in-process, no child)
  debug.test2_http = await new Promise<string>((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port: 8080,
        path: "/health",
        method: "GET",
        timeout: 3000,
        headers: {
          Authorization: `Bearer ${env.WORKER_API_SECRET}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () =>
          resolve(`HTTP_${res.statusCode}: ${data.slice(0, 100)}`),
        );
      },
    );
    req.on("error", (e) => resolve(`HTTP_ERROR: ${e.message}`));
    req.on("timeout", () => {
      req.destroy();
      resolve("HTTP_TIMEOUT");
    });
    req.end();
  });

  // Test 3: spawnSync curl (child process)
  const proc = spawnSync(
    "/usr/bin/curl",
    [
      "-s",
      "--max-time",
      "3",
      "-w",
      "\\n%{http_code}",
      "-H",
      `Authorization: Bearer ${env.WORKER_API_SECRET}`,
      "http://127.0.0.1:8080/health",
    ],
    { timeout: 5000, encoding: "utf-8" },
  );
  debug.test3_curl = {
    status: proc.status,
    stdout: proc.stdout.slice(0, 100),
    pid: proc.pid,
  };

  return NextResponse.json(debug);
}
