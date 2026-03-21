import { createAdminClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/mail/send-email";
import { AnnouncementEmail } from "@/components/emails/announcement-email";
import { env } from "@/lib/env";
import { getUser } from "@/lib/auth/auth-user";
import type { NextRequest } from "next/server";

export const POST = async (req: NextRequest) => {
  const user = await getUser();

  if (!env.ADMIN_USER_ID || user?.id !== env.ADMIN_USER_ID) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  const isTest = req.nextUrl.searchParams.get("test") === "true";

  const admin = createAdminClient();

  // Test mode: only send to the admin
  if (isTest) {
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("id", env.ADMIN_USER_ID)
      .single();

    const email = adminProfile?.email;
    if (!email) {
      return new Response(JSON.stringify({ error: "Admin email not found" }), {
        status: 500,
      });
    }

    const result = await sendEmail({
      to: email,
      subject: "[TEST] A few new things on BriefTube",
      html: AnnouncementEmail(),
      headers: {
        "List-Unsubscribe":
          "<https://www.brief-tube.com/dashboard/profile>, <mailto:hello@brief-tube.com?subject=unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    return new Response(
      JSON.stringify({
        sent: result.error ? 0 : 1,
        failed: result.error ? 1 : 0,
        total: 1,
      }),
      { status: 200 },
    );
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email_announcements", true);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0, total: 0 }), {
      status: 200,
    });
  }

  let sent = 0;
  let failed = 0;

  for (const profile of profiles) {
    const email = profile.email;

    if (!email) {
      failed++;

      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 600));

    // eslint-disable-next-line no-await-in-loop
    const result = await sendEmail({
      to: email,
      subject: "A few new things on BriefTube",
      html: AnnouncementEmail(),
      headers: {
        "List-Unsubscribe":
          "<https://www.brief-tube.com/dashboard/profile>, <mailto:hello@brief-tube.com?subject=unsubscribe>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    if (result.error) {
      failed++;
    } else {
      sent++;
    }
  }

  return new Response(
    JSON.stringify({
      sent,
      failed,
      total: profiles.length,
    }),
    { status: 200 },
  );
};
