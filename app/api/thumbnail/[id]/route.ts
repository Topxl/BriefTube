import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

const FALLBACK_SVG = readFileSync(
  join(process.cwd(), "public/thumbnail-fallback.svg"),
);

const FALLBACK_HEADERS = {
  "Content-Type": "image/svg+xml",
  "Cache-Control": "public, max-age=86400",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // No rate limiting on thumbnails — they're loaded in bulk (10+ per page)
  // and are just a proxy to YouTube thumbnail images (not sensitive)

  const { id } = await params;
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) {
    return new NextResponse(FALLBACK_SVG, { headers: FALLBACK_HEADERS });
  }

  const res = await fetch(`https://img.youtube.com/vi/${clean}/mqdefault.jpg`, {
    next: { revalidate: 604800 },
  });

  if (!res.ok) {
    return new NextResponse(FALLBACK_SVG, { headers: FALLBACK_HEADERS });
  }

  const img = await res.arrayBuffer();
  return new NextResponse(img, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
