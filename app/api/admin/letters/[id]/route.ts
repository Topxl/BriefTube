import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  intro_narrative: z.string().min(1).optional(),
  new_cliffhanger: z.string().max(500).nullable().optional(),
  status: z
    .enum(["draft", "scheduled", "sent", "cancelled", "skipped"])
    .optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
});

/**
 * GET /api/admin/letters/[id]
 * Full letter row including narrative + generated_data + arc_state_snapshot.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const { data: letter, error } = await admin
    .from("weekly_letters")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!letter)
    return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  return NextResponse.json({ letter });
}

/**
 * PATCH /api/admin/letters/[id]
 * Update editable fields.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: letter, error } = await admin
    .from("weekly_letters")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, letter });
}

/**
 * DELETE /api/admin/letters/[id]
 * Permanently remove a letter (use with care; prefer status=cancelled).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("weekly_letters").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
