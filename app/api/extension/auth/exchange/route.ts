import { NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, extensionRoute } from "@/lib/extension-route";
import { decryptHandoff } from "@/lib/extension/handoff-crypto";
import { logger } from "@/lib/logger";
import {
  checkRateLimit,
  getRequestIp,
  publicRateLimit,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = corsPreflight;

const bodySchema = z.object({
  code: z.string().min(20).max(200),
});
type Body = z.infer<typeof bodySchema>;

type HandoffPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

/**
 * Exchange a one-time handoff code (produced by /extension/auth) for the
 * actual Supabase session. The code is invalidated after the first successful
 * call and expires after 2 minutes regardless.
 *
 * Rate-limited aggressively because the code is short-lived and any
 * brute-force attempt is observable.
 */
export const POST = extensionRoute
  .body(bodySchema)
  .handler(async (req, { body }) => {
    const rl = await checkRateLimit(
      publicRateLimit,
      `ext-exchange:${getRequestIp(req)}`,
    );
    if (rl) return rl;

    const { code } = body as Body;
    const admin = createAdminClient();

    const { data: row, error } = await admin
      .from("extension_auth_handoffs")
      .select("code, ciphertext, iv, expires_at, used_at")
      .eq("code", code)
      .maybeSingle();

    if (error) {
      logger.error("[extension/auth/exchange] lookup failed", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      // Unified 400 to avoid leaking whether the code ever existed.
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 },
      );
    }

    // Mark used BEFORE decrypting/returning. If the update affects zero rows,
    // another request won the race — bail out.
    const { data: updated, error: updateError } = await admin
      .from("extension_auth_handoffs")
      .update({ used_at: new Date().toISOString() })
      .eq("code", code)
      .is("used_at", null)
      .select("code")
      .maybeSingle();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Invalid or expired code" },
        { status: 400 },
      );
    }

    const plaintext = decryptHandoff({
      ciphertext: row.ciphertext,
      iv: row.iv,
    });
    if (!plaintext) {
      logger.error("[extension/auth/exchange] decrypt failed");
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    let session: HandoffPayload;
    try {
      session = JSON.parse(plaintext) as HandoffPayload;
    } catch {
      logger.error("[extension/auth/exchange] payload parse failed");
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    return {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
    };
  });
