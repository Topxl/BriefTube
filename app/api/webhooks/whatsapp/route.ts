import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { createHmac } from "crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Twilio signature validation
// https://www.twilio.com/docs/usage/webhooks/webhooks-security
function validateTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string | undefined>,
  signature: string,
): boolean {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], "");
  const expected = createHmac("sha1", authToken)
    .update(url + sortedParams)
    .digest("base64");
  return expected === signature;
}

// Incoming messages from Twilio WhatsApp (POST)
export async function POST(req: NextRequest) {
  const authToken = env.TWILIO_AUTH_TOKEN;

  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body)) as Record<
    string,
    string | undefined
  >;

  // Validate Twilio signature if auth token is configured
  if (authToken) {
    const signature = req.headers.get("x-twilio-signature") ?? "";
    const url = req.nextUrl.toString();
    if (!validateTwilioSignature(authToken, url, params, signature)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
  }

  // Extract the incoming message
  const from = String(params.From ?? "").replace("whatsapp:", "");
  const text = String(params.Body ?? "").trim();

  if (!from || !text) {
    return NextResponse.json({ ok: true });
  }

  // Check if this looks like a magic link token (bt-XXXXXX)
  if (/^bt-[A-Z0-9]{6}$/i.test(text)) {
    const supabase = await createClient();
    const { data: verification } = await supabase
      .from("whatsapp_verifications")
      .select("user_id, expires_at, verified")
      .eq("token", text)
      .eq("verified", false)
      .single();

    if (verification && new Date(verification.expires_at) > new Date()) {
      await supabase
        .from("whatsapp_verifications")
        .update({ verified: true })
        .eq("user_id", verification.user_id);

      await supabase.from("platform_connections").upsert(
        {
          user_id: verification.user_id,
          platform: "whatsapp",
          external_id: from,
          credentials: {},
          connected: true,
        },
        { onConflict: "user_id,platform" },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
