import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  dailyNewsletterTrigger,
  sendUserNewsletter,
} from "@/inngest/newsletter";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [dailyNewsletterTrigger, sendUserNewsletter],
});
