export const SiteConfig = {
  title: "BriefTube",
  freeChannelsLimit: 3,
  trialDays: 7,
  defaultTtsVoice: "en-US-JennyNeural",
  defaultLanguage: "en",
  description:
    "YouTube videos, summarized as audio, delivered to your Telegram",
  prodUrl: "https://www.brief-tube.com",
  appId: "brieftube",
  domain: "brief-tube.com",
  appIcon: "/images/icon.png",
  company: {
    name: "BriefTube",
  },
  brand: {
    primary: "#dc2626", // red-600
  },
  referral: {
    /** Name of the tracking cookie set when a visitor arrives via ?ref= */
    cookieName: "brieftube_ref",
    /** How long the referral cookie persists (days) */
    cookieTtlDays: 30,
    /** Fraction of the monthly invoice credited to the referrer (0.20 = 20%) */
    monthlyRewardFraction: 0.2,
    /** Number of months to credit for an annual subscription referral */
    annualRewardMonths: 1,
    /** Stripe credit currency */
    currency: "usd",
  },
  features: {
    /**
     * If enable, you need to specify the logic of upload here : src/features/images/uploadImageAction.tsx
     * You can use Vercel Blob Storage : https://vercel.com/docs/storage/vercel-blob
     * Or you can use Cloudflare R2 : https://mlv.sh/cloudflare-r2-tutorial
     * Or you can use AWS S3 : https://mlv.sh/aws-s3-tutorial
     */
    enableImageUpload: false as boolean,
    /**
     * If enable, the user will be redirected to `/orgs` when he visits the landing page at `/`
     * The logic is located in middleware.ts
     */
    enableLandingRedirection: true as boolean,
  },
};
