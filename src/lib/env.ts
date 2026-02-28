import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  skipValidation:
    !!process.env.SKIP_ENV_VALIDATION || process.env.VERCEL_ENV === "preview",
  server: {
    // Required — app won't work without these
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_PRO_PRICE_ID: z.string().min(1),
    STRIPE_PRO_ANNUAL_PRICE_ID: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    // Optional — email, AI, etc.
    RESEND_API_KEY: z.string().optional(),
    RESEND_AUDIENCE_ID: z.string().optional(),
    RESEND_WEBHOOK_SECRET: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    YOUTUBE_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    WEBSUB_SECRET: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    ADMIN_USER_ID: z.string().optional(),
    // VPS worker remote API (admin panel logs)
    VPS_WORKER_URL: z.string().url().optional(),
    WORKER_API_SECRET: z.string().optional(),
    // Web Push (VAPID)
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    // Push endpoint auth (shared secret with worker)
    PUSH_NOTIFY_SECRET: z.string().optional(),
    // PostHog analytics (admin panel — visitor data)
    POSTHOG_PERSONAL_API_KEY: z.string().optional(),
    POSTHOG_PROJECT_ID: z.string().optional(),
    NODE_ENV: z.enum(["development", "production", "test"]),
    CI: z.coerce.boolean().optional(),
  },
  client: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    NEXT_PUBLIC_EMAIL_CONTACT: z.string().optional(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_EMAIL_CONTACT: process.env.NEXT_PUBLIC_EMAIL_CONTACT,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
});
