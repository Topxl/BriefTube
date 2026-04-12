import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { execFileSync } from "child_process";

export async function GET() {
  const debug: Record<string, unknown> = {};

  debug.pid = process.pid;
  debug.cwd = process.cwd();

  // Test filesystem access
  const logPath = "/home/brieftube/app/worker/worker.log";
  debug.logExists = existsSync(logPath);
  if (debug.logExists) {
    try {
      const content = readFileSync(logPath, "utf-8");
      debug.logSize = content.length;
      debug.logLastLine = content.trim().split("\n").pop()?.slice(0, 100);
    } catch (e) {
      debug.logError = String(e);
    }
  }

  // Test systemctl
  try {
    const result = execFileSync(
      "/usr/bin/systemctl",
      ["is-active", "brieftube-worker"],
      { timeout: 3000, encoding: "utf-8" },
    );
    debug.systemctl = result.trim();
  } catch (e: unknown) {
    const err = e as { stdout?: string };
    debug.systemctlError = err.stdout?.trim() ?? String(e).slice(0, 100);
  }

  return NextResponse.json(debug);
}
