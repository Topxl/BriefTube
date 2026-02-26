import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";

export const runtime = "edge";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const referralUrl = `${SiteConfig.domain}/r/${code}`;

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background orbs */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "10%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.12)",
          filter: "blur(180px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          right: "5%",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
          filter: "blur(160px)",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 80px",
          zIndex: 1,
          textAlign: "center",
          gap: "0px",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "20px",
            background: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "48px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderLeft: "20px solid transparent",
              borderRight: "0px solid transparent",
              borderTop: "12px solid transparent",
              borderBottom: "12px solid transparent",
              borderLeftColor: "white",
            }}
          />
        </div>

        {/* Brand name */}
        <div
          style={{
            fontSize: "52px",
            fontWeight: "800",
            color: "#ffffff",
            letterSpacing: "-1px",
            marginBottom: "32px",
          }}
        >
          BriefTube
        </div>

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid rgba(239, 68, 68, 0.4)",
            background: "rgba(239, 68, 68, 0.12)",
            borderRadius: "100px",
            padding: "10px 28px",
            marginBottom: "56px",
          }}
        >
          <span
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#f87171",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            14-day free Pro trial
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: "800",
            color: "#ffffff",
            lineHeight: 1.05,
            letterSpacing: "-2px",
            marginBottom: "36px",
            maxWidth: "900px",
          }}
        >
          YouTube, summarized as audio
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: "38px",
            color: "#a1a1aa",
            lineHeight: 1.4,
            maxWidth: "820px",
            marginBottom: "80px",
          }}
        >
          Get AI summaries of your favorite channels delivered to Telegram —
          automatically.
        </div>

        {/* Divider */}
        <div
          style={{
            width: "64px",
            height: "4px",
            background: "#dc2626",
            borderRadius: "2px",
            marginBottom: "64px",
          }}
        />

        {/* URL callout */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              color: "#71717a",
              fontWeight: "500",
              letterSpacing: "0.5px",
            }}
          >
            Start your free trial at
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: "700",
              color: "#ffffff",
              letterSpacing: "-0.5px",
              background: "rgba(255,255,255,0.06)",
              padding: "16px 40px",
              borderRadius: "16px",
            }}
          >
            {referralUrl}
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1920,
    },
  );
}
