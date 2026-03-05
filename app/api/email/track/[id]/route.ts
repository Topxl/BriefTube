import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (id) {
    const admin = createAdminClient();
    // Only set opened_at on first open
    await admin
      .from("email_logs")
      .update({ opened_at: new Date().toISOString() })
      .eq("id", id)
      .is("opened_at", null);
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}
