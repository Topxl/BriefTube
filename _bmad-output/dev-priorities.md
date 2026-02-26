# BriefTube — Development Priorities

**Last updated:** 2026-02-26
**Framework:** P0 (ship blocker) → P1 (growth lever) → P2 (polish)

**Status legend:** ✅ Done · 🔄 In progress · ❌ Not started

---

## Context

**Product:** B2C SaaS — YouTube channels → AI audio summaries → Telegram delivery
**Model:** Free (3 channels) + Pro $9/month (unlimited)
**Trial:** 7 days free Pro
**Core loop:** Signup → Connect Telegram → Add channel → Receive first summary (AHA) → Convert

**Current state:**
- Onboarding wizard: ✅ (3 steps: channels → language → Telegram)
- Billing: ✅ (Stripe, cancel flow, retention offer -50%, annual plan)
- Worker: ✅ (RSS → Gemini → TTS → Telegram, multi-language)
- Emails: ✅ Full lifecycle (welcome, trial J-3/J-1/expired, activation, re-engagement, referral trial)
- Analytics: ✅ Posthog (funnel, onboarding, cancellation, subscription)
- SEO: ✅ /channels index + channel pages + sitemap
- Referral reward: ⚠️ UI + emails done, Stripe credit automation not implemented

---

## P0 — Critical Path (blocks conversion & retention)

> These gaps directly kill the trial-to-paid conversion rate.
> Ship before any new feature.

---

### ✅ P0-1 · Trial expiry email sequence

**Problem:** Users start a 7-day trial and hear nothing until it ends. When it does, there's no email. They just lose access silently.
**Impact:** This is the single biggest conversion leak. Industry benchmark: 3-email drip = +20–40% trial conversion.

**Sequence to build:**
| Timing | Subject | Goal |
|--------|---------|------|
| Trial Day 4 (3 days before) | "Your BriefTube trial ends in 3 days" | Warm reminder + value recap |
| Trial Day 6 (1 day before) | "Last chance — keep your BriefTube summaries" | Urgency + CTA to upgrade |
| Trial Day 7+1 (expired) | "Your trial ended — here's what you're missing" | Loss aversion + discount |

**Implementation:**
- Scheduled job (Supabase pg_cron or worker cron loop)
- Query `profiles` where `trial_ends_at` is in 3 days / 1 day / expired yesterday
- Send via Resend using existing `sendEmail()` pattern
- Track who opens → who converts

---

### ✅ P0-2 · Activation email (Telegram not connected)

**Problem:** Some users complete onboarding but skip the Telegram step. They never get a summary. They never have an AHA moment. They churn silently.
**Signal:** `telegram_connected = false` after 24h of account creation.

**Implementation:**
- Trigger: 24h after signup, if `telegram_connected = false`
- Email: "You're missing your summaries — connect Telegram in 1 click"
- CTA → `/dashboard` with Telegram connection highlighted
- Single send (not recurring)

---

### ✅ P0-3 · Product analytics (Posthog)

**Problem:** Zero funnel visibility. Can't answer: where do users drop off? What's the onboarding completion rate? What % connect Telegram? What's the trial-to-paid CVR?
**Without this, every product decision is a guess.**

**Implementation:**
- Install Posthog (free tier, self-hostable)
- Track key events:
  - `onboarding_step_completed` (step 1/2/3)
  - `telegram_connected`
  - `channel_added`
  - `first_summary_received`
  - `upgrade_clicked`
  - `trial_converted`
  - `subscription_cancelled`
- Funnel view: Signup → Telegram → Channel → Summary → Paid
- Session replay on onboarding (identify drop-off UX issues)

---

### ⚠️ P0-4 · Referral reward automation

**Problem:** Referral page shows "20% monthly credit or 1 free month" but this is never actually applied in Stripe. It's a broken promise.
**Risk:** If a referred user converts and the referrer notices no credit, trust is destroyed.

**Implementation:**
- Stripe: create a coupon `REFERRAL_MONTHLY_20PCT` (20% off, repeating)
- On `customer.subscription.updated` webhook: if referee converts, apply coupon to referrer's subscription via Stripe API
- Or: use Stripe credit balance (`stripe.customers.createBalanceTransaction`)
- Track in `referrals` table: add `rewarded_at` column

---

## P1 — Growth Levers (ship after P0 is done)

> These move acquisition and retention metrics. High ROI, medium effort.

---

### ✅ P1-1 · Annual plan

**Why:** Annual subscribers churn 3–4x less than monthly. Offering annual at $79/year (vs $108/year monthly) = 27% discount, immediate cash, lower churn.
**Implementation:**
- New Stripe price for annual
- Pricing page: toggle Monthly / Annual with "Save 27%" badge
- Checkout flow already supports different price IDs

---

### ✅ P1-2 · Re-engagement email (inactive users)

**Trigger:** Pro user with `telegram_connected = true`, active channel, but 0 deliveries in 7 days.
**Signal:** The channels they follow haven't posted, or something broke silently.
**Email:** "Your channels haven't had new videos — here's how to add more active ones"
- Show top 5 most-followed channels on BriefTube (from admin data)
- CTA → dashboard to add channels

---

### ✅ P1-3 · SEO — Channel discovery pages

**Why:** Zero organic acquisition currently. Google Ads is the only channel.
**Opportunity:** Long-tail searches like "MrBeast summaries", "podcast summaries Telegram", "YouTube audio digest".
**Implementation:**
- `/channels/[channelId]` — public page showing channel stats + "Get audio summaries" CTA
- Sitemap with top 100 followed channels
- Each page: channel name, subscriber count on BriefTube, latest summary date
- No auth required to view

---

### ✅ P1-4 · In-app upsell at channel limit

**Current behavior:** When free user hits 3 channels, they see an error toast.
**Better:** Show a modal "You've reached your 3-channel limit — upgrade to Pro for unlimited channels" with upgrade button directly inline.
**Also:** Trial countdown banner is passive — make it proactive. At day 5, replace with "2 days left — upgrade now and keep all your summaries"

---

### ✅ P1-5 · Upgrade email to referred users

**When a referred user is on trial and nearing expiry:**
Special email variant: "Your friend [referrer first name] uses BriefTube Pro — join them"
- Social proof from a known connection
- Higher CVR than generic trial expiry emails

---

### ❌ P1-6 · Summary quality controls

**User-facing settings:**
- Summary length: Short / Standard / Detailed
- Summary language: independent from TTS voice (summarize in French, even if video is English)
- These map to Gemini prompt parameters already controlled in worker

---

## P2 — Polish (ship when P0+P1 are done)

> Nice to have. Improve experience at the margins.

---

### P2-1 · User dashboard metrics

**What users want to see:**
- Total summaries received this month
- Hours of YouTube "saved" (video duration vs audio duration)
- Channels ranked by how often they post
- Personal listening streak

---

### P2-2 · Email delivery as fallback

**Problem:** Some users don't use Telegram. They still want summaries.
**Solution:** Optional daily email digest — "Here are your 3 new summaries from today" with audio links.
**Note:** This is a significant worker change. Don't build until Telegram delivery is rock-solid.

---

### P2-3 · Public roadmap / changelog

**Why:** Builds trust, reduces churn ("they're still building"), generates organic SEO.
**Implementation:** Simple `/changelog` page pulling from `CHANGELOG.md` or a Notion page.

---

### P2-4 · PWA / mobile homescreen

**Quick win:** `manifest.json` + service worker for "Add to homescreen" on mobile.
**Value:** Users can open BriefTube from their phone homescreen to manage channels.

---

### P2-5 · Webhook notifications

**For power users:** HTTP webhook when a new summary is ready.
**Use case:** Zapier integration, custom Telegram bots, Slack channels.

---

## Execution Order

```
✅ P0 — DONE:
  ├── ✅ P0-3 Posthog — product analytics
  ├── ✅ P0-1 Trial email sequence (J-3, J-1, expired)
  ├── ✅ P0-2 Activation email (Telegram not connected after 24h)
  └── ⚠️  P0-4 Referral reward — UI + emails done, Stripe credit TODO

✅ P1 — 5/6 DONE:
  ├── ✅ P1-1 Annual plan ($79/year, toggle landing + pricing + checkout)
  ├── ✅ P1-2 Re-engagement email (Pro · 0 delivery in 7 days)
  ├── ✅ P1-3 SEO channel pages (/channels + /channels/[id] + sitemap)
  ├── ✅ P1-4 In-app upsell modal at channel limit
  ├── ✅ P1-5 Referral trial emails (J-3/J-1 with referrer first name)
  └── ❌ P1-6 Summary quality controls ← NEXT

Next (P2):
  └── Everything else, prioritized by user feedback
```

---

## Success Metrics

| Metric | Baseline (unknown) | Target after P0 |
|--------|-------------------|-----------------|
| Onboarding completion rate | ? (need Posthog) | > 70% |
| Telegram connection rate | ? (need Posthog) | > 80% of onboarded |
| Trial → Paid CVR | ? (need Posthog) | > 15% |
| Churn rate (monthly) | ? | < 5%/month |
| MRR growth | current | +20%/month |

**The first thing to do is install Posthog (P0-3) so you have real baselines before optimizing anything.**
