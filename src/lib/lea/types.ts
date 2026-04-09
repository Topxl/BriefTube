/**
 * Types partagés pour Léa, l'assistante IA support de BriefTube.
 */

export type LeaMessageRole = "user" | "assistant" | "admin";

export type LeaMessage = {
  id: string;
  conversation_id: string;
  role: LeaMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LeaConversationStatus =
  | "active"
  | "pending_human"
  | "resolved"
  | "archived";

export type LeaConversation = {
  id: string;
  user_id: string;
  status: LeaConversationStatus;
  subject: string | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  resolved_at: string | null;
  last_message_at: string;
  unread_by_admin: boolean;
  created_at: string;
};

/**
 * Structured response shape returned by Gemini for every Léa turn.
 * Enforced via Gemini's responseSchema (structured output).
 */
export type LeaStructuredResponse = {
  /** The user-visible message Léa wants to display. Markdown allowed. */
  message: string;
  /** True when Léa cannot answer and a human must take over. */
  should_escalate: boolean;
  /** Short reason for escalation, in French. Null if not escalating. */
  escalation_reason: string | null;
  /**
   * Set when the user's message looks like a feature request that
   * should be added to the public roadmap. Null otherwise.
   */
  detected_feature_request: {
    title: string;
    description: string;
    category: "feature" | "improvement" | "integration" | "ui_ux" | "other";
  } | null;
  /** Léa's self-rated confidence in her answer (0..1). */
  confidence: number;
  /** Optional short subject for the conversation (set on first turn). */
  conversation_subject?: string | null;
};

/**
 * Context about the user that's injected into Léa's system prompt
 * so she can give personalized answers.
 */
export type LeaUserContext = {
  user_id: string;
  email: string;
  preferred_language: string | null;
  subscription_status: string | null;
  max_channels: number | null;
  channels_used: number | null;
  telegram_connected: boolean;
  trial_ends_at: string | null;
  onboarding_completed: boolean;
  created_at: string;
};

export type LeaKbArticle = {
  id: string;
  title: string;
  content: string;
  category: string;
};
