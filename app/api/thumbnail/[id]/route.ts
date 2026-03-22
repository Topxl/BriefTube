import { NextResponse } from "next/server";

// 1×1 transparent PNG — fallback when YouTube has no thumbnail for this video
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) {
    return new NextResponse(TRANSPARENT_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const res = await fetch(
    `https://img.youtube.com/vi/${clean}/mqdefault.jpg`,
    { next: { revalidate: 604800 } }, // cache 1 week
  );

  if (!res.ok) {
    return new NextResponse(TRANSPARENT_PNG, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const img = await res.arrayBuffer();
  return new NextResponse(img, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800",
    },
  });
}
