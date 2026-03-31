import { createClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  getRequestIp,
  authRateLimit,
  publicRateLimit,
} from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  category: z.string().nullable().optional(),
});

type Params = { params: Promise<{ id: string }> };

// GET /api/lists/[id] — public, get list details + channels + user context
export async function GET(req: NextRequest, { params }: Params) {
  const ip = getRequestIp(req);
  const rateLimitResponse = await checkRateLimit(
    publicRateLimit,
    `lists:${ip}`,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: list, error } = await supabase
    .from("channel_lists")
    .select(
      `
      id,
      name,
      description,
      category,
      is_public,
      created_at,
      created_by,
      list_channels(id, channel_id, channel_name, channel_avatar_url, added_at),
      list_stars(count),
      list_follows(count)
    `,
    )
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (error ?? !list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  let starred = false;
  let following = false;

  if (user) {
    const [starRow, followRow] = await Promise.all([
      supabase
        .from("list_stars")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("list_id", id)
        .maybeSingle(),
      supabase
        .from("list_follows")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("list_id", id)
        .maybeSingle(),
    ]);
    starred = !!starRow.data;
    following = !!followRow.data;
  }

  return NextResponse.json({
    id: list.id,
    name: list.name,
    description: list.description,
    category: list.category,
    created_at: list.created_at,
    created_by: list.created_by,
    channels: list.list_channels,
    star_count:
      (list.list_stars as unknown as { count: number }[])[0]?.count ?? 0,
    follow_count:
      (list.list_follows as unknown as { count: number }[])[0]?.count ?? 0,
    starred,
    following,
  });
}

// PATCH /api/lists/[id] — auth required, owner only, update metadata
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const patchRateLimitResponse = await checkRateLimit(authRateLimit, user.id);
  if (patchRateLimitResponse) return patchRateLimitResponse;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("channel_lists")
    .update(parsed.data)
    .eq("id", id)
    .eq("created_by", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE /api/lists/[id] — auth required, owner only
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleteRateLimitResponse = await checkRateLimit(authRateLimit, user.id);
  if (deleteRateLimitResponse) return deleteRateLimitResponse;

  // RLS enforces owner check, but we check explicitly for a clear 403
  const { data: list } = await supabase
    .from("channel_lists")
    .select("created_by")
    .eq("id", id)
    .single();

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  if (list.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("channel_lists")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
