import { z } from "zod";

// ── Persona detection ───────────────────────────────────────────
export type SurveyPersona = "active" | "inactive";

// ── Active user questions ───────────────────────────────────────

export const PMF_OPTIONS = [
  { value: "very_disappointed", label: "Very disappointed" },
  { value: "somewhat_disappointed", label: "Somewhat disappointed" },
  { value: "not_disappointed", label: "Not disappointed" },
] as const;

export const BENEFIT_OPTIONS = [
  { value: "stay_current", label: "Stay current without watching" },
  { value: "commute", label: "Listen during commute or gym" },
  { value: "save_time", label: "Save time on long videos" },
  { value: "discover", label: "Discover what matters faster" },
] as const;

export const IMPROVEMENT_OPTIONS = [
  { value: "text_summaries", label: "Text summaries alongside audio" },
  { value: "email_delivery", label: "Email delivery" },
  { value: "shorter_summaries", label: "Shorter, punchier summaries" },
  { value: "longer_summaries", label: "Longer, more detailed summaries" },
  { value: "mobile_app", label: "Mobile app" },
  { value: "better_voices", label: "Better audio voices" },
  { value: "video_highlights", label: "Video highlights / timestamps" },
  { value: "multi_language", label: "Multi-language summaries" },
] as const;

export const REFERRAL_OPTIONS = [
  { value: "colleague", label: "A colleague" },
  { value: "student", label: "A student" },
  { value: "creator", label: "A content creator" },
  { value: "podcast_listener", label: "A podcast listener" },
  { value: "no_one", label: "No one comes to mind" },
] as const;

// ── Inactive user questions ─────────────────────────────────────

export const SIGNUP_REASON_OPTIONS = [
  { value: "save_time", label: "Save time on YouTube" },
  { value: "too_many_channels", label: "Too many channels to follow" },
  { value: "listen_on_go", label: "Wanted to listen on the go" },
  { value: "curiosity", label: "Just curious" },
  { value: "ad_clicked", label: "Clicked an ad" },
] as const;

export const BLOCKER_OPTIONS = [
  { value: "setup_confusing", label: "Setup was confusing" },
  { value: "no_telegram", label: "I don't use Telegram / Discord / Slack" },
  { value: "forgot", label: "I just forgot about it" },
  {
    value: "not_enough_channels",
    label: "I don't follow enough YouTube channels",
  },
  { value: "didnt_understand", label: "I didn't understand what I'd get" },
  { value: "no_time", label: "Haven't had time to set it up" },
] as const;

export const CONVINCE_OPTIONS = [
  { value: "email_delivery", label: "Email delivery (no app needed)" },
  { value: "simpler_setup", label: "Simpler setup process" },
  { value: "text_not_audio", label: "Text summaries instead of audio" },
  { value: "see_example", label: "See an example summary first" },
  { value: "mobile_app", label: "A mobile app" },
  { value: "nothing", label: "Probably nothing — not for me" },
] as const;

export const DELIVERY_PREF_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "slack", label: "Slack" },
  { value: "podcast", label: "Podcast app (RSS)" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "app", label: "Mobile app" },
] as const;

// ── Schemas ─────────────────────────────────────────────────────

export const activeSurveySchema = z.object({
  persona: z.literal("active"),
  q1_pmf: z.enum([
    "very_disappointed",
    "somewhat_disappointed",
    "not_disappointed",
  ]),
  q1_other: z.string().optional(),
  q2_benefit: z.enum(["stay_current", "commute", "save_time", "discover"]),
  q2_other: z.string().optional(),
  q3_improvement: z
    .array(z.string())
    .min(1, "Please select at least one option"),
  q3_other: z.string().optional(),
  q4_referral: z.enum([
    "colleague",
    "student",
    "creator",
    "podcast_listener",
    "no_one",
  ]),
  q4_other: z.string().optional(),
  q5_freetext: z.string().optional(),
});

export const inactiveSurveySchema = z.object({
  persona: z.literal("inactive"),
  q1_signup_reason: z.enum([
    "save_time",
    "too_many_channels",
    "listen_on_go",
    "curiosity",
    "ad_clicked",
  ]),
  q1_other: z.string().optional(),
  q2_blocker: z.array(z.string()).min(1, "Please select at least one option"),
  q2_other: z.string().optional(),
  q3_convince: z.array(z.string()).min(1, "Please select at least one option"),
  q3_other: z.string().optional(),
  q4_delivery_pref: z.enum([
    "email",
    "telegram",
    "discord",
    "slack",
    "podcast",
    "whatsapp",
    "app",
  ]),
  q4_other: z.string().optional(),
  q5_freetext: z.string().optional(),
});

export const surveySchema = z.discriminatedUnion("persona", [
  activeSurveySchema,
  inactiveSurveySchema,
]);

export type ActiveSurveyValues = z.infer<typeof activeSurveySchema>;
export type InactiveSurveyValues = z.infer<typeof inactiveSurveySchema>;
export type SurveyFormValues = z.infer<typeof surveySchema>;
