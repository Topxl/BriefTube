import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * API-route variant of requireAdmin().
 *
 * Use in raw NextRequest handlers (not in `authRoute`) when the route
 * is admin-only. Returns either:
 *   - { ok: true, userId } when the caller is the configured admin
 *   - { ok: false, response } with a ready-to-return 401/403 response
 */
export async function requireAdminApi(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!env.ADMIN_USER_ID || user.id !== env.ADMIN_USER_ID) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
