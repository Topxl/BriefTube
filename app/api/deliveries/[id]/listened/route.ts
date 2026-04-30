import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, authRateLimit } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    progressPct: z.number().int().min(0).max(100).optional(),
    completed: z.boolean().optional(),
  })
  .optional();

// POST /api/deliveries/[id]/listened
// Marks engagement on a delivery. Two modes (both idempotent-safe):
//   - No body / empty body  → just sets first-engagement timestamp
//   - { progressPct, completed } → also updates max progress + completion flag
// Progress is monotonic: never decreases (max-of-current-and-incoming).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimitResponse = await checkRateLimit(authRateLimit, user.id);
  if (rateLimitResponse) return rateLimitResponse;

  let body: z.infer<typeof bodySchema> = undefined;
  try {
    const raw: unknown = await req.json();
    body = bodySchema.parse(raw);
  } catch {
    // Empty/missing body is allowed — back-compat with old client
    body = undefined;
  }

  const now = new Date().toISOString();

  // Step 1: ensure first-engagement timestamp is set (idempotent)
  await supabase
    .from("deliveries")
    .update({ listened_at: now })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("listened_at", null);

  // Step 2: if the client reports progress, update progress monotonically.
  // We can't use a single UPDATE with `GREATEST(...)` via the JS client, so
  // read-then-write. The race window is tiny and not safety-critical.
  if (body?.progressPct !== undefined || body?.completed !== undefined) {
    const { data: row } = await supabase
      .from("deliveries")
      .select("listen_progress_pct, completed")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (row) {
      const incomingPct = body.progressPct ?? row.listen_progress_pct ?? 0;
      const newPct = Math.max(row.listen_progress_pct ?? 0, incomingPct);
      const newCompleted =
        row.completed || body.completed === true || newPct >= 90;

      await supabase
        .from("deliveries")
        .update({
          listen_progress_pct: newPct,
          completed: newCompleted,
          last_listened_at: now,
        })
        .eq("id", id)
        .eq("user_id", user.id);
    }
  }

  return NextResponse.json({ ok: true });
}
