/**
 * Types for the weekly narrative letter system.
 *
 * Each letter is an episode in an ongoing story arc Vin tells his community.
 * Sources are ONLY user-facing things: shipped features + curated CHANGELOG
 * entries (FEATURE / FIX). Never raw git commits, never internal refactors.
 */

export type LetterStatus =
  | "draft"
  | "scheduled"
  | "sent"
  | "cancelled"
  | "skipped";

export type LetterCharacter = {
  name: string;
  role: string;
  introduced_in_episode: number;
};

export type LetterOpenThread = {
  title: string;
  description: string;
  foreshadowed_in_episode: number;
  status: "open" | "resolved";
};

/**
 * Persistent narrative state that flows from one letter to the next.
 * The most recent letter's snapshot is "the current state".
 */
export type LetterArcState = {
  current_arc_title: string;
  current_arc_summary: string;
  open_threads: LetterOpenThread[];
  characters: LetterCharacter[];
  recurring_themes: string[];
  last_episode_number: number;
  last_cliffhanger: string;
};

/**
 * Snapshot of the data Léa used to generate this episode.
 * Stored alongside the letter so we can re-generate or audit later.
 */
export type LetterGeneratedData = {
  features_shipped: {
    id: string;
    title: string;
    description: string;
    votes_count: number;
    proposer_email?: string | null;
  }[];
  changelog_entries: {
    date: string;
    type: "FEATURE" | "FIX";
    text: string;
  }[];
  stats: {
    new_users_count: number;
    active_users_count: number;
    summaries_processed: number;
  };
  vin_notes: string | null;
};

/**
 * Structured response from Léa's narrative engine. The intro_narrative is the
 * markdown body, the new_cliffhanger is what we tease for next time, and the
 * arc_state_update lets the model evolve the running story state.
 */
export type LetterDraftResponse = {
  title: string;
  subject: string;
  intro_narrative: string;
  new_cliffhanger: string;
  arc_state_update: LetterArcState;
};

export const EMPTY_ARC_STATE: LetterArcState = {
  current_arc_title: "Genesis",
  current_arc_summary:
    "A solo founder builds an AI service to free people from the YouTube hours hole. The story is just beginning.",
  open_threads: [],
  characters: [
    {
      name: "Vin",
      role: "the solo founder, narrator",
      introduced_in_episode: 1,
    },
    {
      name: "Léa",
      role: "the AI support assistant who learns alongside the users",
      introduced_in_episode: 1,
    },
    {
      name: "the worker",
      role: "the loyal night-shift Python worker that processes videos",
      introduced_in_episode: 1,
    },
    {
      name: "the community",
      role: "early adopters who shape the product through their suggestions",
      introduced_in_episode: 1,
    },
  ],
  recurring_themes: [
    "indie maker journey",
    "building AI in public",
    "the loneliness and joy of solo coding",
    "user-driven product",
  ],
  last_episode_number: 0,
  last_cliffhanger: "",
};
