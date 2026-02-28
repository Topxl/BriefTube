import webpush from "web-push";
import { env } from "@/lib/env";

if (
  env.VAPID_SUBJECT &&
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  env.VAPID_PRIVATE_KEY
) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
}

export { webpush };
