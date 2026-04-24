/**
 * Chrome Web Store asset generator for BriefTube.
 *
 * Loads each HTML template in a headless Chromium viewport sized to the target
 * asset dimensions, waits for fonts + aura blurs to settle, and screenshots
 * the viewport to a PNG in ./output.
 *
 * Run:  pnpm generate
 */
import { chromium, type Browser } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type Asset = {
  name: string;
  template: string;
  width: number;
  height: number;
};

const ASSETS: Asset[] = [
  { name: "screen-1", template: "screen-1.html", width: 1280, height: 800 },
  { name: "screen-2", template: "screen-2.html", width: 1280, height: 800 },
  { name: "screen-3", template: "screen-3.html", width: 1280, height: 800 },
  { name: "screen-4", template: "screen-4.html", width: 1280, height: 800 },
  { name: "screen-5", template: "screen-5.html", width: 1280, height: 800 },
  { name: "promo-tile", template: "promo-tile.html", width: 440, height: 280 },
  { name: "marquee", template: "marquee.html", width: 1400, height: 560 },
  {
    name: "facebook-profile",
    template: "facebook-profile.html",
    width: 400,
    height: 400,
  },
  {
    name: "facebook-cover",
    template: "facebook-cover.html",
    width: 1640,
    height: 924,
  },
];

async function renderOne(browser: Browser, asset: Asset, outputDir: string) {
  const context = await browser.newContext({
    viewport: { width: asset.width, height: asset.height },
    deviceScaleFactor: 1,
    // Important: disable scrollbars, animations
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const templatePath = path.join(__dirname, "templates", asset.template);
  const templateUrl = pathToFileURL(templatePath).href;
  await page.goto(templateUrl, { waitUntil: "domcontentloaded" });
  // Wait for web fonts; fallback to system-ui if network blocks Google Fonts
  try {
    await page.evaluate(() => (document as any).fonts.ready);
  } catch {
    // ignore; system-ui will be used
  }
  // Gradients + blurs settle; also ensures Inter has swapped in
  await page.waitForTimeout(600);

  const outputPath = path.join(outputDir, `${asset.name}.png`);
  await page.screenshot({
    path: outputPath,
    type: "png",
    clip: { x: 0, y: 0, width: asset.width, height: asset.height },
    omitBackground: false,
  });
  const stat = await fs.stat(outputPath);
  console.log(
    `  rendered ${asset.name.padEnd(12)} ${asset.width}x${asset.height}  ${(stat.size / 1024).toFixed(1)} KB`,
  );

  await context.close();
}

async function main() {
  const outputDir = path.join(__dirname, "output");
  await fs.mkdir(outputDir, { recursive: true });

  console.log("Launching Chromium...");
  const browser = await chromium.launch({ headless: true });
  console.log(`Generating ${ASSETS.length} store assets:`);

  for (const asset of ASSETS) {
    await renderOne(browser, asset, outputDir);
  }

  await browser.close();
  console.log("\nDone. Files in output/:");
  const files = await fs.readdir(outputDir);
  for (const f of files.sort()) {
    const p = path.join(outputDir, f);
    const s = await fs.stat(p);
    console.log(`  ${f.padEnd(20)} ${(s.size / 1024).toFixed(1)} KB`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
