import { updateSession } from "@/lib/supabase/middleware";
import { SiteConfig } from "@/site-config";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  const refCode = request.nextUrl.searchParams.get("ref");
  if (refCode && !request.cookies.has(SiteConfig.referral.cookieName)) {
    response.cookies.set(SiteConfig.referral.cookieName, refCode, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: SiteConfig.referral.cookieTtlDays * 24 * 60 * 60,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
