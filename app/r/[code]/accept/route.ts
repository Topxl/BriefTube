import { NextResponse } from "next/server";
import { SiteConfig } from "@/site-config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const response = NextResponse.redirect(`${baseUrl}/login`);
  response.cookies.set(SiteConfig.referral.cookieName, code, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * SiteConfig.referral.cookieTtlDays,
    path: "/",
  });

  return response;
}
