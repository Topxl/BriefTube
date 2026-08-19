-- =============================================================================
-- BriefTube — initial schema
-- =============================================================================
--
-- This is the ONLY file you need to run on a fresh Supabase project.
-- The other files in this directory are the historical migration log of the
-- hosted instance; they are already folded into this snapshot. Do not run them
-- on a new install — they will fail on columns that already exist.
--
-- How to apply
-- ------------
--   1. Create a free project at https://supabase.com/dashboard
--   2. Open the SQL Editor, paste this whole file, run it
--
--   Or from a terminal:
--      psql "$SUPABASE_DB_URL" -f migrations/00000000_initial_schema.sql
--
-- What this creates
-- -----------------
--   33 tables, 46 row-level security policies, 48 indexes, 14 functions,
--   8 triggers, 1 view, and the public `audio` storage bucket.
--
-- Row-level security is enabled on every table. Do not disable it: the web app
-- talks to the database with the anon key on behalf of the signed-in user, and
-- RLS is the only thing keeping one user's summaries away from another's.
--
-- Requires the Supabase-managed `auth` and `storage` schemas. This schema is
-- not portable to a bare PostgreSQL server without them.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto"  WITH SCHEMA extensions;


--
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: count_users_with_channels(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_users_with_channels() RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT count(DISTINCT user_id)::integer FROM subscriptions;
$$;


--
-- Name: enforce_max_channels(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_max_channels() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
  current_active_count INT;
  max_allowed INT;
  user_status TEXT;
  user_trial_ends_at TIMESTAMPTZ;
BEGIN
  IF NEW.active IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.source_type = 'list_follow' THEN RETURN NEW; END IF;

  SELECT max_channels, subscription_status, trial_ends_at
    INTO max_allowed, user_status, user_trial_ends_at
    FROM profiles WHERE id = NEW.user_id;

  IF user_status = 'active'
    OR (user_trial_ends_at IS NOT NULL AND user_trial_ends_at > NOW())
  THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO current_active_count
    FROM subscriptions
    WHERE user_id = NEW.user_id
      AND active = true
      AND (source_type IS NULL OR source_type != 'list_follow');

  IF current_active_count >= COALESCE(max_allowed, 3) THEN
    RAISE EXCEPTION 'Active channel limit reached. Upgrade to Pro for unlimited channels.';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: generate_referral_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_referral_code() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  END IF;
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deliveries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    video_id text NOT NULL,
    status text DEFAULT 'pending'::text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    source text DEFAULT 'auto'::text,
    language text DEFAULT 'fr'::text NOT NULL,
    platform text DEFAULT 'telegram'::text NOT NULL,
    audio_required boolean DEFAULT true NOT NULL,
    listened_at timestamp with time zone,
    listen_progress_pct integer,
    completed boolean DEFAULT false NOT NULL,
    last_listened_at timestamp with time zone,
    CONSTRAINT deliveries_listen_progress_pct_range CHECK (((listen_progress_pct IS NULL) OR ((listen_progress_pct >= 0) AND (listen_progress_pct <= 100)))),
    CONSTRAINT deliveries_source_check CHECK ((source = ANY (ARRAY['auto'::text, 'on_demand'::text]))),
    CONSTRAINT deliveries_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text])))
);


--
-- Name: get_feed_deliveries(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_feed_deliveries(p_user_id uuid, p_limit integer, p_offset integer) RETURNS SETOF public.deliveries
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT * FROM (
    SELECT DISTINCT ON (d.video_id) d.*
    FROM deliveries d
    INNER JOIN processed_videos pv ON d.video_id = pv.video_id AND d.language = pv.language
    WHERE d.user_id = p_user_id
      AND pv.status = 'completed'
    ORDER BY d.video_id, d.created_at DESC
  ) t
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;


--
-- Name: get_list_follow_feed(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_list_follow_feed(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(video_id text, channel_id text, title text, published_at timestamp with time zone, is_summarized boolean, delivery_id uuid, language text)
    LANGUAGE sql STABLE
    AS $$
  WITH list_channels AS (
    SELECT DISTINCT channel_id FROM subscriptions
    WHERE user_id = p_user_id AND source_type = 'list_follow' AND active = true
  ),
  user_deliveries AS (
    SELECT DISTINCT ON (video_id) id as delivery_id, video_id, language, created_at
    FROM deliveries WHERE user_id = p_user_id
    ORDER BY video_id, created_at DESC
  )
  SELECT
    cv.video_id,
    cv.channel_id,
    cv.title,
    cv.published_at,
    (ud.delivery_id IS NOT NULL) as is_summarized,
    ud.delivery_id,
    ud.language
  FROM channel_videos cv
  INNER JOIN list_channels lc ON cv.channel_id = lc.channel_id
  LEFT JOIN user_deliveries ud ON cv.video_id = ud.video_id
  ORDER BY cv.published_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;


--
-- Name: get_unified_feed(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unified_feed(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(video_id text, channel_id text, title text, published_at timestamp with time zone, is_summarized boolean, delivery_id uuid, language text)
    LANGUAGE sql STABLE
    AS $$
  WITH user_channels AS (
    SELECT DISTINCT channel_id FROM subscriptions
    WHERE user_id = p_user_id AND active = true
  ),
  user_deliveries AS (
    SELECT DISTINCT ON (video_id) id as delivery_id, video_id, language, created_at
    FROM deliveries WHERE user_id = p_user_id
    ORDER BY video_id, created_at DESC
  )
  SELECT
    cv.video_id,
    cv.channel_id,
    cv.title,
    cv.published_at,
    (ud.delivery_id IS NOT NULL) as is_summarized,
    ud.delivery_id,
    ud.language
  FROM channel_videos cv
  INNER JOIN user_channels uc ON cv.channel_id = uc.channel_id
  LEFT JOIN user_deliveries ud ON cv.video_id = ud.video_id
  ORDER BY cv.published_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;


--
-- Name: get_user_summary_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_summary_counts(user_id_in uuid) RETURNS TABLE(total bigint, this_month bigint)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    COUNT(DISTINCT video_id) AS total,
    COUNT(DISTINCT video_id) FILTER (
      WHERE date_trunc('month', sent_at) = date_trunc('month', now())
    ) AS this_month
  FROM deliveries
  WHERE user_id = user_id_in AND status = 'sent';
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;


--
-- Name: increment_extension_user_usage(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_extension_user_usage(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_count integer;
BEGIN
  INSERT INTO extension_user_usage (user_id, usage_date, summaries_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date) DO UPDATE SET
    summaries_count = extension_user_usage.summaries_count + 1,
    updated_at = now()
  RETURNING summaries_count INTO new_count;
  RETURN new_count;
END;
$$;


--
-- Name: processing_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processing_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id text NOT NULL,
    youtube_url text NOT NULL,
    video_title text,
    channel_id text NOT NULL,
    channel_name text,
    priority integer DEFAULT 0,
    status text DEFAULT 'queued'::text,
    worker_id text,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    user_language text DEFAULT 'fr'::text,
    tts_voice text,
    retry_after timestamp with time zone,
    summary_length_pref text DEFAULT 'standard'::text NOT NULL,
    summary_style text DEFAULT 'narrative'::text NOT NULL,
    summary_custom_instructions text DEFAULT ''::text NOT NULL,
    CONSTRAINT processing_queue_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: pick_next_processing_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pick_next_processing_job() RETURNS SETOF public.processing_queue
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  job processing_queue;
BEGIN
  SELECT *
  INTO job
  FROM processing_queue
  WHERE status = 'queued'
    AND (retry_after IS NULL OR retry_after <= NOW())
  ORDER BY COALESCE(priority, 0) DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF job.id IS NULL THEN
    RETURN;
  END IF;

  UPDATE processing_queue
  SET status = 'processing'
  WHERE id = job.id
  RETURNING * INTO job;

  RETURN NEXT job;
END;
$$;


--
-- Name: prevent_sensitive_profile_changes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_sensitive_profile_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    RAISE EXCEPTION 'Cannot modify subscription_status';
  END IF;
  IF NEW.max_channels IS DISTINCT FROM OLD.max_channels THEN
    RAISE EXCEPTION 'Cannot modify max_channels';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'Cannot modify stripe_customer_id';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: update_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update public.chat_conversations
     set last_message_at = new.created_at,
         unread_by_admin = case
           when new.role = 'user' then true
           else unread_by_admin
         end
   where id = new.conversation_id;
  return new;
end;
$$;


--
-- Name: update_feature_votes_count(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_feature_votes_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (tg_op = 'INSERT') then
    update public.feature_requests
       set votes_count = votes_count + 1,
           updated_at = now()
     where id = new.feature_request_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.feature_requests
       set votes_count = greatest(votes_count - 1, 0),
           updated_at = now()
     where id = old.feature_request_id;
    return old;
  end if;
  return null;
end;
$$;


--
-- Name: abandoned_checkouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abandoned_checkouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_session_id text NOT NULL,
    plan text,
    "interval" text,
    amount_total integer,
    currency text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    recovered_at timestamp with time zone
);


--
-- Name: business_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    company text,
    role text,
    team_size text,
    channels text[] DEFAULT '{}'::text[] NOT NULL,
    use_case text,
    ip text,
    user_agent text,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cancellation_feedbacks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_feedbacks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reason text NOT NULL,
    custom_message text,
    offer_accepted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_by uuid NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: channel_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id text NOT NULL,
    channel_id text NOT NULL,
    title text NOT NULL,
    published_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    subject text,
    escalated_at timestamp with time zone,
    escalation_reason text,
    resolved_at timestamp with time zone,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    unread_by_admin boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending_human'::text, 'resolved'::text, 'archived'::text])))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chat_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'admin'::text])))
);


--
-- Name: deleted_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deleted_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    deleted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email_type text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    opened_at timestamp with time zone
);


--
-- Name: extension_auth_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extension_auth_handoffs (
    code text NOT NULL,
    user_id uuid NOT NULL,
    ciphertext text NOT NULL,
    iv text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: extension_user_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extension_user_usage (
    user_id uuid NOT NULL,
    usage_date date DEFAULT CURRENT_DATE NOT NULL,
    summaries_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: feature_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    category text DEFAULT 'feature'::text NOT NULL,
    priority integer DEFAULT 3 NOT NULL,
    votes_count integer DEFAULT 0 NOT NULL,
    admin_notes text,
    source text DEFAULT 'user_form'::text NOT NULL,
    shipped_notification_sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    needs_admin_review boolean DEFAULT false NOT NULL,
    CONSTRAINT feature_requests_category_check CHECK ((category = ANY (ARRAY['feature'::text, 'improvement'::text, 'integration'::text, 'ui_ux'::text, 'other'::text]))),
    CONSTRAINT feature_requests_priority_check CHECK (((priority >= 1) AND (priority <= 5))),
    CONSTRAINT feature_requests_source_check CHECK ((source = ANY (ARRAY['user_form'::text, 'chat_detected'::text, 'admin_created'::text]))),
    CONSTRAINT feature_requests_status_check CHECK ((status = ANY (ARRAY['new'::text, 'under_review'::text, 'planned'::text, 'in_progress'::text, 'shipped'::text, 'rejected'::text])))
);


--
-- Name: feature_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feature_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    feature_request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: list_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.list_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    list_id uuid NOT NULL,
    channel_id text NOT NULL,
    channel_name text NOT NULL,
    channel_avatar_url text,
    added_at timestamp with time zone DEFAULT now()
);


--
-- Name: list_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.list_follows (
    user_id uuid NOT NULL,
    list_id uuid NOT NULL,
    followed_at timestamp with time zone DEFAULT now()
);


--
-- Name: list_stars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.list_stars (
    user_id uuid NOT NULL,
    list_id uuid NOT NULL,
    starred_at timestamp with time zone DEFAULT now()
);


--
-- Name: platform_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    platform text NOT NULL,
    external_id text NOT NULL,
    credentials jsonb DEFAULT '{}'::jsonb,
    connected boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: processed_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processed_videos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    video_id text NOT NULL,
    channel_id text NOT NULL,
    video_title text,
    video_url text,
    summary text,
    audio_url text,
    status text DEFAULT 'pending'::text,
    failure_count integer DEFAULT 0,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    transcript_cost numeric(10,6) DEFAULT 0.0,
    transcript_source text,
    source_language text,
    transcript_length integer DEFAULT 0,
    summary_length integer DEFAULT 0,
    retry_count integer DEFAULT 0,
    retry_at timestamp with time zone,
    transcript_status text DEFAULT 'pending'::text,
    metadata jsonb DEFAULT '{}'::jsonb,
    language text DEFAULT 'fr'::text NOT NULL,
    audio_status text,
    transcript_text text,
    length_pref text,
    style_pref text,
    model_used text,
    summary_cost_usd numeric(10,6),
    summary_word_count integer,
    audio_duration_sec numeric(8,2),
    generation_latency_ms jsonb,
    CONSTRAINT processed_videos_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'skipped'::text]))),
    CONSTRAINT processed_videos_transcript_source_check CHECK ((transcript_source = ANY (ARRAY['youtube'::text, 'groq'::text, 'manual'::text, 'youtube_api'::text, 'invidious'::text, 'piped'::text, 'yt-dlp'::text, 'whisper'::text]))),
    CONSTRAINT processed_videos_transcript_status_check CHECK ((transcript_status = ANY (ARRAY['pending'::text, 'available'::text, 'failed'::text, 'retry'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    telegram_chat_id text,
    telegram_connected boolean DEFAULT false,
    telegram_connect_token text,
    tts_voice text DEFAULT 'en-US-JennyNeural'::text,
    subscription_status text DEFAULT 'free'::text,
    stripe_customer_id text,
    stripe_subscription_id text,
    max_channels integer DEFAULT 5,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    preferred_language text DEFAULT 'en'::text,
    trial_ends_at timestamp with time zone,
    onboarding_completed boolean DEFAULT false,
    referral_code text,
    referred_by uuid,
    notify_new_summaries_push boolean DEFAULT false,
    email_newsletter boolean DEFAULT true,
    email_announcements boolean DEFAULT true,
    favorite_languages text[] DEFAULT '{}'::text[] NOT NULL,
    newsletter_enabled boolean DEFAULT true,
    newsletter_hour integer DEFAULT 8,
    rss_token uuid DEFAULT gen_random_uuid() NOT NULL,
    newsletter_full_summary boolean DEFAULT false NOT NULL,
    youtube_sync_diff jsonb,
    summary_length_pref text DEFAULT 'auto'::text NOT NULL,
    summary_style text DEFAULT 'narrative'::text NOT NULL,
    summary_custom_instructions text DEFAULT ''::text NOT NULL,
    audio_enabled boolean DEFAULT true NOT NULL,
    youtube_refresh_token text,
    youtube_refresh_token_iv text,
    extension_installed_at timestamp with time zone,
    CONSTRAINT profiles_newsletter_hour_check CHECK (((newsletter_hour >= 0) AND (newsletter_hour <= 23))),
    CONSTRAINT profiles_subscription_status_check CHECK ((subscription_status = ANY (ARRAY['free'::text, 'active'::text, 'cancelled'::text, 'past_due'::text]))),
    CONSTRAINT profiles_summary_length_pref_check CHECK ((summary_length_pref = ANY (ARRAY['brief'::text, 'standard'::text, 'detailed'::text, 'auto'::text]))),
    CONSTRAINT profiles_summary_style_check CHECK ((summary_style = ANY (ARRAY['key_points'::text, 'narrative'::text, 'actionable'::text])))
);


--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    endpoint text NOT NULL,
    keys_auth text NOT NULL,
    keys_p256dh text NOT NULL,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    referrer_id uuid NOT NULL,
    referee_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reward_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    rewarded_at timestamp with time zone
);


--
-- Name: shared_summaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shared_summaries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    short_id text NOT NULL,
    video_id text NOT NULL,
    language text DEFAULT 'fr'::text NOT NULL,
    shared_by uuid,
    view_count integer DEFAULT 0,
    max_views integer DEFAULT 100,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    channel_id text NOT NULL,
    channel_name text NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    channel_avatar_url text,
    source_type text DEFAULT 'youtube_channel'::text,
    list_id uuid,
    paused_by_system boolean DEFAULT false NOT NULL,
    summary_length_pref text,
    summary_style text,
    summary_custom_instructions text
);


--
-- Name: support_kb_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_kb_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: survey_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.survey_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    q1_pmf text,
    q2_benefit text,
    q3_friction text[] DEFAULT '{}'::text[] NOT NULL,
    q4_improvement text[] DEFAULT '{}'::text[] NOT NULL,
    q5_referral text,
    q6_freetext text,
    reward_granted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    persona text,
    responses jsonb
);


--
-- Name: transcript_cost_analytics; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.transcript_cost_analytics WITH (security_invoker='true') AS
 SELECT date(created_at) AS date,
    count(*) AS total_videos,
    sum(
        CASE
            WHEN (transcript_source = 'youtube'::text) THEN 1
            ELSE 0
        END) AS youtube_count,
    sum(
        CASE
            WHEN (transcript_source = 'groq'::text) THEN 1
            ELSE 0
        END) AS groq_count,
    sum(transcript_cost) AS total_cost,
    avg(transcript_cost) AS avg_cost,
    sum(transcript_length) AS total_chars
   FROM public.processed_videos
  WHERE (status = 'completed'::text)
  GROUP BY (date(created_at))
  ORDER BY (date(created_at)) DESC;


--
-- Name: user_active_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_active_days (
    user_id uuid NOT NULL,
    day date NOT NULL
);


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    status text DEFAULT 'processed'::text NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: websub_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.websub_subscriptions (
    channel_id text NOT NULL,
    subscribed_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone,
    status text DEFAULT 'pending'::text
);


--
-- Name: weekly_letters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_letters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    episode_number integer NOT NULL,
    week_start date NOT NULL,
    week_end date NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    title text,
    subject text,
    intro_narrative text,
    new_cliffhanger text,
    generated_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    arc_state_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    recipient_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT weekly_letters_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scheduled'::text, 'sent'::text, 'cancelled'::text, 'skipped'::text])))
);


--
-- Name: whatsapp_verifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_verifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone text,
    code text,
    expires_at timestamp with time zone NOT NULL,
    verified boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    token text
);


--
-- Name: worker_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.worker_stats (
    date date NOT NULL,
    videos_processed integer DEFAULT 0 NOT NULL,
    videos_failed integer DEFAULT 0 NOT NULL,
    deliveries_sent integer DEFAULT 0 NOT NULL,
    deliveries_failed integer DEFAULT 0 NOT NULL,
    groq_seconds double precision DEFAULT 0 NOT NULL,
    groq_cost double precision DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: abandoned_checkouts abandoned_checkouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abandoned_checkouts
    ADD CONSTRAINT abandoned_checkouts_pkey PRIMARY KEY (id);


--
-- Name: abandoned_checkouts abandoned_checkouts_stripe_session_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abandoned_checkouts
    ADD CONSTRAINT abandoned_checkouts_stripe_session_id_key UNIQUE (stripe_session_id);


--
-- Name: business_waitlist business_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_waitlist
    ADD CONSTRAINT business_waitlist_pkey PRIMARY KEY (id);


--
-- Name: cancellation_feedbacks cancellation_feedbacks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_feedbacks
    ADD CONSTRAINT cancellation_feedbacks_pkey PRIMARY KEY (id);


--
-- Name: channel_lists channel_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_lists
    ADD CONSTRAINT channel_lists_pkey PRIMARY KEY (id);


--
-- Name: channel_videos channel_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_videos
    ADD CONSTRAINT channel_videos_pkey PRIMARY KEY (id);


--
-- Name: channel_videos channel_videos_video_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_videos
    ADD CONSTRAINT channel_videos_video_id_key UNIQUE (video_id);


--
-- Name: chat_conversations chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: deleted_accounts deleted_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deleted_accounts
    ADD CONSTRAINT deleted_accounts_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_user_video_platform_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_user_video_platform_unique UNIQUE (user_id, video_id, platform);


--
-- Name: email_logs email_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_pkey PRIMARY KEY (id);


--
-- Name: email_logs email_logs_unique_per_type; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_unique_per_type UNIQUE (user_id, email_type);


--
-- Name: extension_auth_handoffs extension_auth_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension_auth_handoffs
    ADD CONSTRAINT extension_auth_handoffs_pkey PRIMARY KEY (code);


--
-- Name: extension_user_usage extension_user_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension_user_usage
    ADD CONSTRAINT extension_user_usage_pkey PRIMARY KEY (user_id, usage_date);


--
-- Name: feature_requests feature_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_requests
    ADD CONSTRAINT feature_requests_pkey PRIMARY KEY (id);


--
-- Name: feature_votes feature_votes_feature_request_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_votes
    ADD CONSTRAINT feature_votes_feature_request_id_user_id_key UNIQUE (feature_request_id, user_id);


--
-- Name: feature_votes feature_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_votes
    ADD CONSTRAINT feature_votes_pkey PRIMARY KEY (id);


--
-- Name: list_channels list_channels_list_id_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_channels
    ADD CONSTRAINT list_channels_list_id_channel_id_key UNIQUE (list_id, channel_id);


--
-- Name: list_channels list_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_channels
    ADD CONSTRAINT list_channels_pkey PRIMARY KEY (id);


--
-- Name: list_follows list_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_follows
    ADD CONSTRAINT list_follows_pkey PRIMARY KEY (user_id, list_id);


--
-- Name: list_stars list_stars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_stars
    ADD CONSTRAINT list_stars_pkey PRIMARY KEY (user_id, list_id);


--
-- Name: platform_connections platform_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_connections
    ADD CONSTRAINT platform_connections_pkey PRIMARY KEY (id);


--
-- Name: platform_connections platform_connections_user_id_platform_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_connections
    ADD CONSTRAINT platform_connections_user_id_platform_key UNIQUE (user_id, platform);


--
-- Name: processed_videos processed_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_videos
    ADD CONSTRAINT processed_videos_pkey PRIMARY KEY (id);


--
-- Name: processed_videos processed_videos_video_id_language_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processed_videos
    ADD CONSTRAINT processed_videos_video_id_language_key UNIQUE (video_id, language);


--
-- Name: processing_queue processing_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_pkey PRIMARY KEY (id);


--
-- Name: processing_queue processing_queue_video_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processing_queue
    ADD CONSTRAINT processing_queue_video_id_unique UNIQUE (video_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_referral_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referral_code_key UNIQUE (referral_code);


--
-- Name: push_subscriptions push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_referee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referee_id_key UNIQUE (referee_id);


--
-- Name: shared_summaries shared_summaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_summaries
    ADD CONSTRAINT shared_summaries_pkey PRIMARY KEY (id);


--
-- Name: shared_summaries shared_summaries_short_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_summaries
    ADD CONSTRAINT shared_summaries_short_id_key UNIQUE (short_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_channel_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_channel_id_key UNIQUE (user_id, channel_id);


--
-- Name: support_kb_articles support_kb_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_kb_articles
    ADD CONSTRAINT support_kb_articles_pkey PRIMARY KEY (id);


--
-- Name: survey_responses survey_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_pkey PRIMARY KEY (id);


--
-- Name: user_active_days user_active_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_days
    ADD CONSTRAINT user_active_days_pkey PRIMARY KEY (user_id, day);


--
-- Name: webhook_events webhook_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_event_id_key UNIQUE (event_id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: websub_subscriptions websub_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websub_subscriptions
    ADD CONSTRAINT websub_subscriptions_pkey PRIMARY KEY (channel_id);


--
-- Name: weekly_letters weekly_letters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_letters
    ADD CONSTRAINT weekly_letters_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_verifications whatsapp_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_verifications
    ADD CONSTRAINT whatsapp_verifications_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_verifications whatsapp_verifications_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_verifications
    ADD CONSTRAINT whatsapp_verifications_token_key UNIQUE (token);


--
-- Name: whatsapp_verifications whatsapp_verifications_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_verifications
    ADD CONSTRAINT whatsapp_verifications_user_id_key UNIQUE (user_id);


--
-- Name: worker_stats worker_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.worker_stats
    ADD CONSTRAINT worker_stats_pkey PRIMARY KEY (date);


--
-- Name: business_waitlist_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_waitlist_created_at_idx ON public.business_waitlist USING btree (created_at DESC);


--
-- Name: business_waitlist_email_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_waitlist_email_unique ON public.business_waitlist USING btree (lower(email));


--
-- Name: deleted_accounts_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX deleted_accounts_email_idx ON public.deleted_accounts USING btree (email);


--
-- Name: deliveries_user_listened_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX deliveries_user_listened_at_idx ON public.deliveries USING btree (user_id, listened_at) WHERE (listened_at IS NOT NULL);


--
-- Name: idx_abandoned_checkouts_created_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abandoned_checkouts_created_pending ON public.abandoned_checkouts USING btree (created_at) WHERE (recovered_at IS NULL);


--
-- Name: idx_abandoned_checkouts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_abandoned_checkouts_user_id ON public.abandoned_checkouts USING btree (user_id);


--
-- Name: idx_cancellation_feedbacks_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cancellation_feedbacks_user_id ON public.cancellation_feedbacks USING btree (user_id);


--
-- Name: idx_channel_lists_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_lists_created_by ON public.channel_lists USING btree (created_by);


--
-- Name: idx_channel_videos_channel_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_videos_channel_id ON public.channel_videos USING btree (channel_id);


--
-- Name: idx_channel_videos_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_channel_videos_published_at ON public.channel_videos USING btree (published_at DESC);


--
-- Name: idx_chat_conv_last_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conv_last_msg ON public.chat_conversations USING btree (last_message_at DESC);


--
-- Name: idx_chat_conv_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conv_status ON public.chat_conversations USING btree (status) WHERE (status = ANY (ARRAY['pending_human'::text, 'active'::text]));


--
-- Name: idx_chat_conv_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conv_unread ON public.chat_conversations USING btree (unread_by_admin) WHERE (unread_by_admin = true);


--
-- Name: idx_chat_conv_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_conv_user ON public.chat_conversations USING btree (user_id);


--
-- Name: idx_chat_msg_conv; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_msg_conv ON public.chat_messages USING btree (conversation_id, created_at);


--
-- Name: idx_deliveries_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_completed ON public.deliveries USING btree (completed) WHERE (listened_at IS NOT NULL);


--
-- Name: idx_deliveries_source_user_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_source_user_created ON public.deliveries USING btree (user_id, source, created_at);


--
-- Name: idx_deliveries_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_status ON public.deliveries USING btree (status, user_id);


--
-- Name: idx_deliveries_status_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deliveries_status_created_at ON public.deliveries USING btree (status, created_at) WHERE (status = 'pending'::text);


--
-- Name: idx_extension_auth_handoffs_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extension_auth_handoffs_expires_at ON public.extension_auth_handoffs USING btree (expires_at);


--
-- Name: idx_extension_user_usage_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extension_user_usage_date ON public.extension_user_usage USING btree (usage_date);


--
-- Name: idx_feature_req_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_req_created ON public.feature_requests USING btree (created_at DESC);


--
-- Name: idx_feature_req_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_req_pending ON public.feature_requests USING btree (needs_admin_review) WHERE (needs_admin_review = true);


--
-- Name: idx_feature_req_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_req_status ON public.feature_requests USING btree (status);


--
-- Name: idx_feature_req_votes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_req_votes ON public.feature_requests USING btree (votes_count DESC);


--
-- Name: idx_feature_votes_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feature_votes_user ON public.feature_votes USING btree (user_id);


--
-- Name: idx_list_follows_list_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_list_follows_list_id ON public.list_follows USING btree (list_id);


--
-- Name: idx_list_stars_list_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_list_stars_list_id ON public.list_stars USING btree (list_id);


--
-- Name: idx_platform_connections_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_connections_platform ON public.platform_connections USING btree (platform, connected);


--
-- Name: idx_platform_connections_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_connections_user ON public.platform_connections USING btree (user_id);


--
-- Name: idx_processed_videos_audio_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_videos_audio_status ON public.processed_videos USING btree (audio_status) WHERE (audio_status IS NOT NULL);


--
-- Name: idx_processed_videos_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_videos_created_at ON public.processed_videos USING btree (created_at DESC);


--
-- Name: idx_processed_videos_model_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_videos_model_used ON public.processed_videos USING btree (model_used) WHERE ((status = 'completed'::text) AND (model_used IS NOT NULL));


--
-- Name: idx_processed_videos_processed_at_completed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_videos_processed_at_completed ON public.processed_videos USING btree (processed_at DESC) WHERE (status = 'completed'::text);


--
-- Name: idx_processed_videos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processed_videos_status ON public.processed_videos USING btree (status);


--
-- Name: idx_processing_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processing_queue_status ON public.processing_queue USING btree (status);


--
-- Name: idx_profiles_referred_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_referred_by ON public.profiles USING btree (referred_by);


--
-- Name: idx_push_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions USING btree (user_id);


--
-- Name: idx_referrals_referrer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_referrals_referrer_id ON public.referrals USING btree (referrer_id);


--
-- Name: idx_subscriptions_channel; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_channel ON public.subscriptions USING btree (channel_id);


--
-- Name: idx_subscriptions_list_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_list_id ON public.subscriptions USING btree (list_id);


--
-- Name: idx_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_user ON public.subscriptions USING btree (user_id);


--
-- Name: idx_support_kb_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_support_kb_enabled ON public.support_kb_articles USING btree (enabled, "position") WHERE (enabled = true);


--
-- Name: idx_survey_responses_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_survey_responses_user ON public.survey_responses USING btree (user_id);


--
-- Name: idx_user_active_days_user_day_desc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_active_days_user_day_desc ON public.user_active_days USING btree (user_id, day DESC);


--
-- Name: idx_webhook_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_created_at ON public.webhook_events USING btree (created_at DESC);


--
-- Name: idx_webhook_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_webhook_events_type ON public.webhook_events USING btree (event_type);


--
-- Name: idx_weekly_letters_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_letters_status ON public.weekly_letters USING btree (status);


--
-- Name: idx_weekly_letters_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_weekly_letters_week ON public.weekly_letters USING btree (week_start DESC);


--
-- Name: profiles_rss_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX profiles_rss_token_idx ON public.profiles USING btree (rss_token);


--
-- Name: shared_summaries_shared_by_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shared_summaries_shared_by_created_at_idx ON public.shared_summaries USING btree (shared_by, created_at);


--
-- Name: shared_summaries_short_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shared_summaries_short_id_idx ON public.shared_summaries USING btree (short_id);


--
-- Name: uniq_weekly_letters_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uniq_weekly_letters_episode ON public.weekly_letters USING btree (episode_number);


--
-- Name: subscriptions check_max_channels_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER check_max_channels_before_insert BEFORE INSERT ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.enforce_max_channels();


--
-- Name: profiles guard_profile_sensitive_columns; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guard_profile_sensitive_columns BEFORE UPDATE ON public.profiles FOR EACH ROW WHEN ((current_setting('role'::text) = 'authenticated'::text)) EXECUTE FUNCTION public.prevent_sensitive_profile_changes();


--
-- Name: profiles set_referral_code; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_referral_code BEFORE INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();


--
-- Name: chat_messages trg_chat_messages_update_conv; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_chat_messages_update_conv AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();


--
-- Name: feature_requests trg_feature_requests_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_feature_requests_updated_at BEFORE UPDATE ON public.feature_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: feature_votes trg_feature_votes_count; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_feature_votes_count AFTER INSERT OR DELETE ON public.feature_votes FOR EACH ROW EXECUTE FUNCTION public.update_feature_votes_count();


--
-- Name: support_kb_articles trg_support_kb_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_support_kb_updated_at BEFORE UPDATE ON public.support_kb_articles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: weekly_letters trg_weekly_letters_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_weekly_letters_updated_at BEFORE UPDATE ON public.weekly_letters FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: abandoned_checkouts abandoned_checkouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abandoned_checkouts
    ADD CONSTRAINT abandoned_checkouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: cancellation_feedbacks cancellation_feedbacks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_feedbacks
    ADD CONSTRAINT cancellation_feedbacks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: channel_lists channel_lists_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_lists
    ADD CONSTRAINT channel_lists_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_conversations chat_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_conversations
    ADD CONSTRAINT chat_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: email_logs email_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_logs
    ADD CONSTRAINT email_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: extension_auth_handoffs extension_auth_handoffs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension_auth_handoffs
    ADD CONSTRAINT extension_auth_handoffs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: extension_user_usage extension_user_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extension_user_usage
    ADD CONSTRAINT extension_user_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: feature_requests feature_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_requests
    ADD CONSTRAINT feature_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: feature_votes feature_votes_feature_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_votes
    ADD CONSTRAINT feature_votes_feature_request_id_fkey FOREIGN KEY (feature_request_id) REFERENCES public.feature_requests(id) ON DELETE CASCADE;


--
-- Name: feature_votes feature_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feature_votes
    ADD CONSTRAINT feature_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: list_channels list_channels_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_channels
    ADD CONSTRAINT list_channels_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.channel_lists(id) ON DELETE CASCADE;


--
-- Name: list_follows list_follows_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_follows
    ADD CONSTRAINT list_follows_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.channel_lists(id) ON DELETE CASCADE;


--
-- Name: list_follows list_follows_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_follows
    ADD CONSTRAINT list_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: list_stars list_stars_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_stars
    ADD CONSTRAINT list_stars_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.channel_lists(id) ON DELETE CASCADE;


--
-- Name: list_stars list_stars_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.list_stars
    ADD CONSTRAINT list_stars_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: platform_connections platform_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_connections
    ADD CONSTRAINT platform_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES public.profiles(id);


--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referee_id_fkey FOREIGN KEY (referee_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: referrals referrals_referrer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_referrer_id_fkey FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: shared_summaries shared_summaries_shared_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shared_summaries
    ADD CONSTRAINT shared_summaries_shared_by_fkey FOREIGN KEY (shared_by) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.channel_lists(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: survey_responses survey_responses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.survey_responses
    ADD CONSTRAINT survey_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: user_active_days user_active_days_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_active_days
    ADD CONSTRAINT user_active_days_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: whatsapp_verifications whatsapp_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_verifications
    ADD CONSTRAINT whatsapp_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);


--
-- Name: cancellation_feedbacks Users can insert own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own feedback" ON public.cancellation_feedbacks FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: cancellation_feedbacks Users can view own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own feedback" ON public.cancellation_feedbacks FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: abandoned_checkouts Users can view their own abandoned checkouts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own abandoned checkouts" ON public.abandoned_checkouts FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: subscriptions Users delete own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users delete own subscriptions" ON public.subscriptions FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: subscriptions Users insert own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users insert own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: platform_connections Users manage own connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own connections" ON public.platform_connections USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: push_subscriptions Users manage own push subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own push subscriptions" ON public.push_subscriptions USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: whatsapp_verifications Users manage own whatsapp verifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own whatsapp verifications" ON public.whatsapp_verifications USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: deliveries Users read own deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own deliveries" ON public.deliveries FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: profiles Users read own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING ((( SELECT auth.uid() AS uid) = id));


--
-- Name: subscriptions Users read own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own subscriptions" ON public.subscriptions FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: processed_videos Users read processed videos for their deliveries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read processed videos for their deliveries" ON public.processed_videos FOR SELECT USING ((video_id IN ( SELECT d.video_id
   FROM public.deliveries d
  WHERE (d.user_id = ( SELECT auth.uid() AS uid)))));


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));


--
-- Name: subscriptions Users update own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users update own subscriptions" ON public.subscriptions FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id));


--
-- Name: abandoned_checkouts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_conversations admin_views_all_chat_conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_views_all_chat_conversations ON public.chat_conversations FOR SELECT USING ((auth.uid() = '67320a39-948c-44d2-98e3-c0de49af1ec6'::uuid));


--
-- Name: chat_messages admin_views_all_chat_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_views_all_chat_messages ON public.chat_messages FOR SELECT USING ((auth.uid() = '67320a39-948c-44d2-98e3-c0de49af1ec6'::uuid));


--
-- Name: feature_requests admin_views_all_feature_requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_views_all_feature_requests ON public.feature_requests FOR SELECT USING ((auth.uid() = '67320a39-948c-44d2-98e3-c0de49af1ec6'::uuid));


--
-- Name: weekly_letters admin_views_all_weekly_letters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_views_all_weekly_letters ON public.weekly_letters FOR SELECT USING ((auth.uid() = '67320a39-948c-44d2-98e3-c0de49af1ec6'::uuid));


--
-- Name: feature_requests anyone_view_approved_features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_view_approved_features ON public.feature_requests FOR SELECT USING ((needs_admin_review = false));


--
-- Name: feature_votes anyone_view_votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY anyone_view_votes ON public.feature_votes FOR SELECT USING (true);


--
-- Name: feature_requests auth_create_own_features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_create_own_features ON public.feature_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: feature_votes auth_create_own_votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_create_own_votes ON public.feature_votes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: feature_votes auth_delete_own_votes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auth_delete_own_votes ON public.feature_votes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: channel_videos authenticated users can read channel_videos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "authenticated users can read channel_videos" ON public.channel_videos FOR SELECT TO authenticated USING (true);


--
-- Name: business_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: cancellation_feedbacks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cancellation_feedbacks ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: deleted_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deleted_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: deleted_accounts deleted_accounts_deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY deleted_accounts_deny_all ON public.deleted_accounts AS RESTRICTIVE USING (false);


--
-- Name: deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: email_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: extension_auth_handoffs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extension_auth_handoffs ENABLE ROW LEVEL SECURITY;

--
-- Name: extension_user_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extension_user_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: extension_user_usage extension_user_usage_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extension_user_usage_self_read ON public.extension_user_usage FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: feature_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: feature_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feature_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: list_channels list owner delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "list owner delete" ON public.list_channels FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.channel_lists
  WHERE ((channel_lists.id = list_channels.list_id) AND (channel_lists.created_by = ( SELECT auth.uid() AS uid))))));


--
-- Name: list_channels list owner insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "list owner insert" ON public.list_channels FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.channel_lists
  WHERE ((channel_lists.id = list_channels.list_id) AND (channel_lists.created_by = ( SELECT auth.uid() AS uid))))));


--
-- Name: list_channels list owner update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "list owner update" ON public.list_channels FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.channel_lists
  WHERE ((channel_lists.id = list_channels.list_id) AND (channel_lists.created_by = ( SELECT auth.uid() AS uid))))));


--
-- Name: list_channels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.list_channels ENABLE ROW LEVEL SECURITY;

--
-- Name: list_channels list_channels_public_via_list; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY list_channels_public_via_list ON public.list_channels FOR SELECT USING (((EXISTS ( SELECT 1
   FROM public.channel_lists
  WHERE ((channel_lists.id = list_channels.list_id) AND (channel_lists.is_public = true)))) OR (EXISTS ( SELECT 1
   FROM public.channel_lists
  WHERE ((channel_lists.id = list_channels.list_id) AND (channel_lists.created_by = auth.uid()))))));


--
-- Name: list_follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.list_follows ENABLE ROW LEVEL SECURITY;

--
-- Name: list_stars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.list_stars ENABLE ROW LEVEL SECURITY;

--
-- Name: list_follows own follows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own follows" ON public.list_follows USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: list_stars own stars; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "own stars" ON public.list_stars USING ((user_id = ( SELECT auth.uid() AS uid)));


--
-- Name: channel_lists owner delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner delete" ON public.channel_lists FOR DELETE USING ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: channel_lists owner insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner insert" ON public.channel_lists FOR INSERT WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: channel_lists owner update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "owner update" ON public.channel_lists FOR UPDATE USING ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: platform_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: processed_videos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processed_videos ENABLE ROW LEVEL SECURITY;

--
-- Name: processing_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_lists public read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "public read" ON public.channel_lists FOR SELECT USING ((is_public = true));


--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

--
-- Name: referrals referrer can read own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "referrer can read own" ON public.referrals FOR SELECT USING ((referrer_id = ( SELECT auth.uid() AS uid)));


--
-- Name: processing_queue service_role_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_role_all ON public.processing_queue TO service_role USING (true) WITH CHECK (true);


--
-- Name: shared_summaries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shared_summaries ENABLE ROW LEVEL SECURITY;

--
-- Name: shared_summaries shared_summaries_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shared_summaries_select_public ON public.shared_summaries FOR SELECT USING (true);


--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: support_kb_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_kb_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: survey_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: user_active_days; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_active_days ENABLE ROW LEVEL SECURITY;

--
-- Name: user_active_days user_active_days_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_active_days_select_own ON public.user_active_days FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: chat_conversations users_create_own_conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_create_own_conversations ON public.chat_conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_conversations users_view_own_conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_view_own_conversations ON public.chat_conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: chat_messages users_view_own_messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_view_own_messages ON public.chat_messages FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.chat_conversations c
  WHERE ((c.id = chat_messages.conversation_id) AND (c.user_id = auth.uid())))));


--
-- Name: feature_requests users_view_own_pending_features; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_view_own_pending_features ON public.feature_requests FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: websub_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.websub_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: websub_subscriptions websub_subscriptions_deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY websub_subscriptions_deny_all ON public.websub_subscriptions AS RESTRICTIVE USING (false);


--
-- Name: weekly_letters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.weekly_letters ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_verifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_verifications ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.worker_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: worker_stats worker_stats_deny_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY worker_stats_deny_all ON public.worker_stats AS RESTRICTIVE USING (false);


--
--




-- =============================================================================
-- Objects outside the `public` schema
-- =============================================================================
-- pg_dump --schema=public cannot see these, but the app does not work without
-- them. Keep them in sync by hand.


-- -----------------------------------------------------------------------------
-- Profile bootstrap
-- -----------------------------------------------------------------------------
-- Every row in auth.users needs a matching row in public.profiles. Without this
-- trigger, sign-up succeeds but the user lands on an empty dashboard forever.
-- The function itself is defined above, in the public schema.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- -----------------------------------------------------------------------------
-- Storage
-- -----------------------------------------------------------------------------
-- Generated audio summaries live here. The bucket is public on purpose:
-- Telegram, Slack and Discord fetch the file over plain HTTPS with no auth
-- header, so a signed URL would break delivery. File names are unguessable.

INSERT INTO storage.buckets (id, name, public)
VALUES ('audio', 'audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access on audio" ON storage.objects;
CREATE POLICY "Public read access on audio"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'audio');

DROP POLICY IF EXISTS "Service role upload access on audio" ON storage.objects;
CREATE POLICY "Service role upload access on audio"
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'audio');
