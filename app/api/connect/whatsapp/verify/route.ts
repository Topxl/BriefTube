import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const verifySchema = z.object({
  phone: z.string(),
  code: z.string().length(6),
});

type VerifyBody = z.infer<typeof verifySchema>;

export const POST = authRoute
  .body(verifySchema)
  .handler(async (_req, { body, ctx }) => {
    const supabase = await createClient();
    const { phone, code } = body as VerifyBody;

    const { data: verification } = await supabase
      .from("whatsapp_verifications")
      .select("code, expires_at, verified")
      .eq("user_id", ctx.user.id)
      .eq("phone", phone)
      .single();

    if (!verification) {
      throw new Error("No pending verification found");
    }
    if (verification.verified) {
      throw new Error("Already verified");
    }
    if (new Date(verification.expires_at) < new Date()) {
      throw new Error("Code expired");
    }
    if (verification.code !== code) {
      throw new Error("Invalid code");
    }

    await supabase
      .from("whatsapp_verifications")
      .update({ verified: true })
      .eq("user_id", ctx.user.id);

    await supabase.from("platform_connections").upsert({
      user_id: ctx.user.id,
      platform: "whatsapp",
      external_id: phone,
      credentials: {},
      connected: true,
    });

    return { ok: true };
  });
