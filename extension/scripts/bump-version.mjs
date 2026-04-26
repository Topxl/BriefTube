#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

const targets = [
  { path: join(root, "manifest.json"), key: "version" },
  { path: join(root, "manifest.prod.json"), key: "version" },
  { path: join(root, "package.json"), key: "version" },
];

const files = targets.map((t) => ({
  ...t,
  json: JSON.parse(readFileSync(t.path, "utf8")),
}));

const cmp = (a, b) => {
  const [aM, am, ap] = a.split(".").map(Number);
  const [bM, bm, bp] = b.split(".").map(Number);
  return aM - bM || am - bm || ap - bp;
};

const current = files.reduce(
  (acc, f) => (cmp(f.json[f.key], acc) > 0 ? f.json[f.key] : acc),
  "0.0.0",
);
const [major, minor, patch] = current.split(".").map(Number);
const next = `${major}.${minor}.${patch + 1}`;

for (const f of files) {
  f.json[f.key] = next;
  writeFileSync(f.path, JSON.stringify(f.json, null, 2) + "\n");
}

console.log(`[bump-version] ${current} -> ${next}`);
