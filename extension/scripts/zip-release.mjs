#!/usr/bin/env node
import { readFileSync, existsSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const distPath = join(root, "dist");

if (!existsSync(distPath)) {
  console.error("[zip-release] dist/ not found — run the build first");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(distPath, "manifest.json"), "utf8"));
const zipName = `brieftube-extension-v${manifest.version}.zip`;
const zipPath = join(root, zipName);

if (existsSync(zipPath)) rmSync(zipPath);

execSync(`zip -r "${zipPath}" . -x "*.DS_Store"`, {
  cwd: distPath,
  stdio: "ignore",
});

console.log(`[zip-release] ${zipName}`);
