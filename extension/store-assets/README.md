# BriefTube - Chrome Web Store assets

Regenerates the 7 listing PNGs (5 screenshots 1280x800, 1 promo tile 440x280, 1 marquee 1400x560) from self-contained HTML templates in `templates/`.

## Usage

```bash
pnpm install
pnpm generate
```

Output lands in `output/` (gitignored). Templates render with real assets: the BriefTube logo is inlined as base64 (from `../public/icons/icon-128.png`) and YouTube thumbnails are served from `assets/` (local JPGs pre-fetched from `i.ytimg.com`).

## Editing

Each template in `templates/` is self-contained. Edit copy, colours or layout and re-run `pnpm generate` - Playwright launches a fresh Chromium at the exact viewport size and screenshots.

## Thumbnails (`assets/`)

The 14 JPGs in `assets/` were downloaded from `https://i.ytimg.com/vi/{videoId}/maxresdefault.jpg` (with `hqdefault.jpg` fallback) and are committed alongside the templates. If YouTube ever rotates thumbnail URLs or removes a video, re-fetch with `curl -sL https://i.ytimg.com/vi/{id}/maxresdefault.jpg -o assets/{id}.jpg`. The screen-2 collage uses 12 music videos; swap to any 12 IDs by replacing the filenames and the `SCREEN_2_TILES` constant.

## Logo

`icon-128.png` is inlined as base64 directly in every template. To refresh it, regenerate with `base64 -w0 ../public/icons/icon-128.png` and paste into the `src="data:image/png;base64,..."` attributes.

Design spec lives in `../STORE_ASSETS.md`.
