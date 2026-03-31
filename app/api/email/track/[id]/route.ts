import { NextResponse } from "next/server";
import { checkRateLimit, getRequestIp, publicRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rateLimitResponse = await checkRateLimit(publicRateLimit, `track:${getRequestIp(_req)}`);
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;

  if (id && UUID_REGEX.test(id)) {
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
