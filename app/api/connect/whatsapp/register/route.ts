import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { z } from "zod";

const registerSchema = z.object({
  phone: z
    .string()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      "Must be a valid E.164 phone number (e.g. +33612345678)",
    ),
});

type RegisterBody = z.infer<typeof registerSchema>;

export const POST = authRoute
  .body(registerSchema)
  .handler(async (_req, { body, ctx }) => {
    const supabase = await createClient();
    const { phone } = body as RegisterBody;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("whatsapp_verifications").upsert(
      {
        user_id: ctx.user.id,
        phone,
        code,
        expires_at: expiresAt,
        verified: false,
      },
      { onConflict: "user_id" },
    );

    const workerUrl = env.VPS_WORKER_URL;
    const workerSecret = env.WORKER_API_SECRET;

    if (!workerUrl || !workerSecret) {
      throw new Error("Worker not configured");
    }

    const res = await fetch(`${workerUrl}/send-whatsapp-otp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, code }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WhatsApp send failed: ${err.slice(0, 200)}`);
    }

    return { ok: true };
  });
