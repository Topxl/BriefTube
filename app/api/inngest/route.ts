import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  dailyNewsletterTrigger,
  sendUserNewsletter,
} from "@/inngest/newsletter";
import {
  onboardingJ1Trigger,
  sendOnboardingJ1,
  onboardingJ3Trigger,
  sendOnboardingJ3,
  activationJ1Trigger,
  sendActivationEmail,
} from "@/inngest/onboarding";
import { weeklyLetterDraftTrigger } from "@/inngest/weekly-letter";
import {
  streakBreakWarningTrigger,
  sendStreakBreakWarning,
} from "@/inngest/streak";
import {
  checkoutAbandonedTrigger,
  sendCheckoutAbandoned,
} from "@/inngest/checkout-abandoned";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dailyNewsletterTrigger,
    sendUserNewsletter,
    onboardingJ1Trigger,
    sendOnboardingJ1,
    onboardingJ3Trigger,
    sendOnboardingJ3,
    weeklyLetterDraftTrigger,
    streakBreakWarningTrigger,
    sendStreakBreakWarning,
    checkoutAbandonedTrigger,
    sendCheckoutAbandoned,
    activationJ1Trigger,
    sendActivationEmail,
  ],
});
