import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import * as net from "node:net";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";

export async function GET() {
  const debug: Record<string, unknown> = {};

  // Auth info (but don't block tests)
  try {
    const user = await getUser();
    debug.userId = user?.id ? `${user.id.slice(0, 8)}...` : null;
    debug.isAdmin = !!env.ADMIN_USER_ID && user?.id === env.ADMIN_USER_ID;
  } catch (e) {
    debug.authError = String(e);
  }

  debug.workerUrl = env.VPS_WORKER_URL ?? "NOT SET";
  debug.pid = process.pid;

  // Test 1: raw TCP to 127.0.0.1:8080 (no secrets needed)
  debug.tcp_127 = await tcpTest("127.0.0.1", 8080);

  // Test 2: raw TCP to 0.0.0.0:8080
  debug.tcp_000 = await tcpTest("0.0.0.0", 8080);

  // Test 3: raw TCP to localhost:8080
  debug.tcp_localhost = await tcpTest("localhost", 8080);

  // Test 4: TCP to port 3000 (self - should work)
  debug.tcp_self = await tcpTest("127.0.0.1", 3000);

  // Test 5: curl to 127.0.0.1:8080 (no auth, expect 401)
  const proc = spawnSync(
    "/usr/bin/curl",
    [
      "-s",
      "--max-time",
      "3",
      "-o",
      "/dev/null",
      "-w",
      "%{http_code}",
      "http://127.0.0.1:8080/health",
    ],
    { timeout: 5000, encoding: "utf-8" },
  );
  debug.curl_status = proc.status;
  debug.curl_http = proc.stdout.trim();
  debug.curl_pid = proc.pid;

  return NextResponse.json(debug);
}

async function tcpTest(host: string, port: number): Promise<string> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.connect(port, host, () => {
      sock.destroy();
      resolve("OK");
    });
    sock.on("error", (e) => {
      sock.destroy();
      resolve(`ERR: ${e.message}`);
    });
    sock.on("timeout", () => {
      sock.destroy();
      resolve("TIMEOUT");
    });
  });
}
