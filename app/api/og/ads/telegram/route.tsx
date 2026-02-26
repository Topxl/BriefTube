import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";
import fs from "fs";
import path from "path";

type Format = "square" | "portrait" | "landscape";

const DIMS: Record<Format, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  landscape: { width: 1200, height: 628 },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fmt = (searchParams.get("format") ?? "square") as Format;
  const { width, height } = DIMS[fmt];
  const isLandscape = fmt === "landscape";

  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallback = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallback);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const headlinePx = isLandscape ? 64 : 80;
  const subtitlePx = isLandscape ? 28 : 34;
  const cardPad = isLandscape ? "28px 36px" : "36px 44px";
  const topPad = isLandscape ? 52 : 72;
  const gap = isLandscape ? 32 : 52;

  // Waveform bar heights — alternating pattern
  const bars = [18, 32, 48, 60, 42, 54, 36, 50, 28, 40, 56, 34, 46, 30, 52];

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isLandscape ? "row" : "column",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "-80px",
          right: "-80px",
          width: "560px",
          height: "560px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.14)",
          filter: "blur(180px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-60px",
          left: "-60px",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
          filter: "blur(150px)",
        }}
      />

      {/* Red top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "5px",
          background: "#dc2626",
        }}
      />

      {/* Left / main column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: isLandscape ? `${topPad}px 56px` : `${topPad}px 72px`,
          gap: `${gap}px`,
          justifyContent: isLandscape ? "center" : "flex-start",
        }}
      >
        {/* Logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <img
            src={logoSrc}
            width={isLandscape ? 48 : 58}
            height={isLandscape ? 48 : 58}
            style={{ borderRadius: "12px" }}
          />
          <span
            style={{
              fontSize: isLandscape ? 30 : 36,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            BriefTube
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              fontSize: headlinePx,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.0,
              letterSpacing: "-2.5px",
            }}
          >
            Stop watching.
          </div>
          <div
            style={{
              fontSize: headlinePx,
              fontWeight: 900,
              color: "#dc2626",
              lineHeight: 1.0,
              letterSpacing: "-2.5px",
            }}
          >
            Start listening.
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: subtitlePx,
            color: "#71717a",
            lineHeight: 1.5,
            maxWidth: isLandscape ? "440px" : "800px",
          }}
        >
          AI audio summaries of your YouTube channels, delivered straight to
          Telegram.
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            { label: "47 min video", accent: false },
            { label: "→", accent: false },
            { label: "4 min summary", accent: true },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                background: item.accent
                  ? "rgba(220,38,38,0.15)"
                  : "rgba(255,255,255,0.06)",
                border: `1px solid ${item.accent ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: "100px",
                padding: "10px 22px",
              }}
            >
              <span
                style={{
                  fontSize: isLandscape ? 22 : 26,
                  fontWeight: 700,
                  color: item.accent ? "#f87171" : "#a1a1aa",
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Domain */}
        {isLandscape && (
          <div style={{ fontSize: 22, color: "#52525b", fontWeight: 500 }}>
            {SiteConfig.domain}
          </div>
        )}
      </div>

      {/* Right column / audio card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: isLandscape ? "center" : "flex-start",
          padding: isLandscape ? "52px 56px 52px 0" : "0 72px 72px",
          gap: "20px",
        }}
      >
        {/* Telegram-style audio card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "24px",
            padding: cardPad,
            width: isLandscape ? "360px" : "100%",
          }}
        >
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {/* Telegram icon placeholder */}
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: "rgba(41, 182, 246, 0.2)",
                border: "1px solid rgba(41, 182, 246, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              ✈️
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              <span style={{ fontSize: 22, fontWeight: 700, color: "#ffffff" }}>
                BriefTube
              </span>
              <span style={{ fontSize: 16, color: "#52525b" }}>
                Audio Summary
              </span>
            </div>
          </div>

          {/* Channel + title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              padding: "16px 20px",
              background: "rgba(255,255,255,0.04)",
              borderRadius: "14px",
              borderLeft: "3px solid #dc2626",
            }}
          >
            <span style={{ fontSize: 16, color: "#71717a", fontWeight: 600 }}>
              Lex Fridman Podcast
            </span>
            <span
              style={{
                fontSize: 20,
                color: "#e4e4e7",
                fontWeight: 700,
                lineHeight: 1.3,
              }}
            >
              #467 — Sam Altman on AI
            </span>
          </div>

          {/* Audio player */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {/* Play button */}
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                background: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "8px solid transparent",
                  borderBottom: "8px solid transparent",
                  borderLeft: "14px solid #ffffff",
                  marginLeft: "3px",
                }}
              />
            </div>

            {/* Waveform */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
                flex: 1,
              }}
            >
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: "4px",
                    height: `${h}px`,
                    borderRadius: "2px",
                    background: i < 6 ? "#dc2626" : "rgba(255,255,255,0.2)",
                  }}
                />
              ))}
            </div>

            {/* Duration */}
            <span
              style={{
                fontSize: 18,
                color: "#71717a",
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              3:47
            </span>
          </div>
        </div>

        {/* Trial badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "rgba(220,38,38,0.12)",
            border: "1px solid rgba(220,38,38,0.25)",
            borderRadius: "100px",
            padding: "10px 24px",
            alignSelf: "flex-start",
          }}
        >
          <span style={{ fontSize: 18, color: "#f87171", fontWeight: 700 }}>
            Free {SiteConfig.trialDays}-day trial
          </span>
          <span style={{ fontSize: 16, color: "#71717a" }}>·</span>
          <span style={{ fontSize: 18, color: "#71717a", fontWeight: 500 }}>
            {SiteConfig.domain}
          </span>
        </div>
      </div>
    </div>,
    { width, height },
  );
}
