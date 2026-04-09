import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/auth/require-admin-api";

type Params = { params: Promise<{ id: string }> };

const FEATURE_STATUSES = [
  "new",
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "rejected",
] as const;

const FEATURE_CATEGORIES = [
  "feature",
  "improvement",
  "integration",
  "ui_ux",
  "other",
] as const;

const patchSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(2000).optional(),
  status: z.enum(FEATURE_STATUSES).optional(),
  category: z.enum(FEATURE_CATEGORIES).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  admin_notes: z.string().max(2000).nullable().optional(),
  needs_admin_review: z.boolean().optional(),
});

/**
 * PATCH /api/admin/features/[id]
 * Admin updates a feature request (status, priority, notes, etc.).
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
  const { data: feature, error } = await admin
    .from("feature_requests")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feature });
}

/**
 * DELETE /api/admin/features/[id]
 * Hard delete a feature (use sparingly — prefer status=rejected).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("feature_requests").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
