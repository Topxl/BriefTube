/**
 * Shared helpers for all Next.js OG image routes.
 * Import with: import { loadLogoBase64, OG_BARS } from "@/lib/og";
 */
import fs from "fs";
import path from "path";

/** Waveform bar heights — used across all OG images */
export const OG_BARS = [
  18, 32, 52, 64, 44, 58, 36, 54, 28, 48, 60, 34, 50, 40, 56, 30, 46, 62, 38,
  52,
];

/** Load the BriefTube logo as a base64 data URL (Node.js runtime only). */
export function loadLogoBase64(): string {
  const hd = path.join(process.cwd(), "public/logo-hd.png");
  const fallback = path.join(process.cwd(), "public/logo-120.png");
  const buf = fs.existsSync(hd)
    ? fs.readFileSync(hd)
    : fs.readFileSync(fallback);
  return `data:image/png;base64,${buf.toString("base64")}`;
}
