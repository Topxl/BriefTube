import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json({
    userId: user?.id ?? null,
    email: user?.email ?? null,
    expectedId: "67320a39-948c-44d2-98e3-c0de49af1ec6",
    match: user?.id === "67320a39-948c-44d2-98e3-c0de49af1ec6",
  });
}
