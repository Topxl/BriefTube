import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const cookieNames = req.cookies
    .getAll()
    .map((c) => c.name)
    .join(", ");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    method: req.method,
    cookies: cookieNames,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    authError: error?.message ?? null,
    host: req.headers.get("host"),
    xForwardedHost: req.headers.get("x-forwarded-host"),
    xForwardedProto: req.headers.get("x-forwarded-proto"),
  });
}

export async function POST(req: NextRequest) {
  const cookieNames = req.cookies
    .getAll()
    .map((c) => c.name)
    .join(", ");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    method: req.method,
    cookies: cookieNames,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    authError: error?.message ?? null,
    host: req.headers.get("host"),
  });
}

export async function DELETE(req: NextRequest) {
  const cookieNames = req.cookies
    .getAll()
    .map((c) => c.name)
    .join(", ");
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    method: req.method,
    cookies: cookieNames,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    authError: error?.message ?? null,
    host: req.headers.get("host"),
  });
}
