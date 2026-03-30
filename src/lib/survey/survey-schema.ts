import { z } from "zod";

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
  { value: "not_enough_use", label: "I haven't used it enough to say" },
] as const;

export const FRICTION_OPTIONS = [
  { value: "nothing", label: "Nothing — it works great" },
  { value: "setup_confusing", label: "Setup was confusing" },
  { value: "delivery_unclear", label: "Didn't know how to connect delivery" },
  { value: "audio_quality", label: "Audio quality wasn't good enough" },
  { value: "summaries_shallow", label: "Summaries weren't detailed enough" },
  { value: "forgot", label: "I just forgot about it" },
  {
    value: "not_enough_channels",
    label: "I don't have enough channels to follow",
  },
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

export const surveySchema = z.object({
  q1_pmf: z.enum([
    "very_disappointed",
    "somewhat_disappointed",
    "not_disappointed",
  ]),
  q2_benefit: z.enum([
    "stay_current",
    "commute",
    "save_time",
    "discover",
    "not_enough_use",
  ]),
  q3_friction: z.array(z.string()).min(1, "Please select at least one option"),
  q4_improvement: z
    .array(z.string())
    .min(1, "Please select at least one option"),
  q5_referral: z.enum([
    "colleague",
    "student",
    "creator",
    "podcast_listener",
    "no_one",
  ]),
  q6_freetext: z.string().optional(),
});

export type SurveyFormValues = z.infer<typeof surveySchema>;
