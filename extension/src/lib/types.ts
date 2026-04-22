export type ExtensionUser = {
  id: string;
  email: string | null;
  avatarUrl: string | null;
  preferredLanguage: string;
  ttsVoice: string | null;
  summaryLengthPref: "brief" | "standard" | "detailed";
  summaryStyle: "narrative" | "key_points" | "actionable";
};

export type ExtensionQuota = {
  isPro: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAtIso: string;
};

export type MeResponse = {
  authenticated: boolean;
  user: ExtensionUser | null;
  quota: ExtensionQuota;
};

export type SummarizeRequest = {
  videoId: string;
  videoTitle?: string;
  channelId?: string;
  channelName?: string;
  transcript: string;
  sourceLanguage?: string;
  targetLanguage?: string;
  videoDurationSec?: number;
  lengthPref?: "brief" | "standard" | "detailed";
  stylePref?: "narrative" | "key_points" | "actionable";
  deviceId?: string;
};

export type SummarizeResponse = {
  summary: string;
  language: string;
  sourceLanguage: string | null;
  cached: boolean;
  quotaRemaining?: number | null;
  audioUrl?: string | null;
  model?: string | null;
};

export type StatusResponse = {
  status:
    | "not_found"
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | string;
  summary: string | null;
  transcript: string | null;
  audioUrl: string | null;
  language: string;
  sourceLanguage: string | null;
  videoTitle: string | null;
};

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

export type BgMessage =
  | { type: "ME" }
  | { type: "SUMMARIZE"; payload: SummarizeRequest }
  | {
      type: "ENQUEUE";
      payload: {
        videoId: string;
        videoTitle?: string;
        channelId?: string;
        targetLanguage?: string;
      };
    }
  | {
      type: "STATUS";
      payload: { videoId: string; language: string };
    }
  | {
      type: "SUBSCRIBE_CHANNEL";
      payload: {
        channelId: string;
        channelName: string;
        channelAvatarUrl?: string;
      };
    }
  | { type: "SIGN_IN" }
  | { type: "SIGN_OUT" }
  | { type: "GET_DEVICE_ID" };
