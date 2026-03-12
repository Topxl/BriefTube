import { authRoute } from "@/lib/zod-route";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { z } from "zod";

const generateToken = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "bt-";
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
};

export const POST = authRoute
  .body(z.object({}))
  .handler(async (_req, { ctx }) => {
    const supabase = await createClient();
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await supabase.from("whatsapp_verifications").upsert(
      {
        user_id: ctx.user.id,
        token,
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

    const res = await fetch(
      `${workerUrl}/get-whatsapp-link?token=${encodeURIComponent(token)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${workerSecret}`,
        },
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`WhatsApp link failed: ${err.slice(0, 200)}`);
    }

    const data = (await res.json()) as { waLink: string };
    return { waLink: data.waLink };
  });
