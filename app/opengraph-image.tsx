import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";
import fs from "fs";
import path from "path";

export const alt = SiteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Waveform bar heights
const BARS = [
  18, 32, 52, 64, 44, 58, 36, 54, 28, 48, 60, 34, 50, 40, 56, 30, 46, 62, 38,
  52,
];

export default function OGImage() {
  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallback = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallback);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glows */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-100px",
          width: "580px",
          height: "580px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.13)",
          filter: "blur(200px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-80px",
          left: "200px",
          width: "360px",
          height: "360px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.07)",
          filter: "blur(160px)",
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

      {/* Left column — content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingTop: "64px",
          paddingBottom: "64px",
          paddingLeft: "72px",
          paddingRight: "48px",
          gap: "28px",
          flex: 1,
        }}
      >
        {/* Logo + brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <img
            src={logoSrc}
            width={48}
            height={48}
            style={{ borderRadius: "11px" }}
          />
          <span
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            BriefTube
          </span>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.0,
              letterSpacing: "-3px",
            }}
          >
            Stop watching.
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 900,
              color: "#dc2626",
              lineHeight: 1.0,
              letterSpacing: "-3px",
            }}
          >
            Start listening.
          </div>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 26,
            color: "#71717a",
            lineHeight: 1.5,
            maxWidth: "520px",
          }}
        >
          AI audio summaries of your YouTube channels, delivered to Telegram,
          Discord or Slack.
        </div>

        {/* Platform badges */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {["Telegram", "Discord", "Slack"].map((p) => (
            <div
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: "100px",
                paddingTop: 8,
                paddingBottom: 8,
                paddingLeft: 18,
                paddingRight: 18,
              }}
            >
              <span style={{ fontSize: 20, fontWeight: 600, color: "#a1a1aa" }}>
                {p}
              </span>
            </div>
          ))}
        </div>

        {/* Domain */}
        <div style={{ fontSize: 20, color: "#3f3f46", fontWeight: 500 }}>
          {SiteConfig.domain}
        </div>
      </div>

      {/* Right column — audio card visual */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: "400px",
          paddingRight: "56px",
          gap: "20px",
        }}
      >
        {/* Mock audio card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "22px",
            padding: "28px",
            width: "320px",
          }}
        >
          {/* BriefTube sender row */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <img
              src={logoSrc}
              width={36}
              height={36}
              style={{ borderRadius: "9px" }}
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 700, color: "#ffffff" }}>
                BriefTube
              </span>
              <span style={{ fontSize: 13, color: "#52525b" }}>
                Audio summary
              </span>
            </div>
          </div>

          {/* Channel + title */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span style={{ fontSize: 13, color: "#52525b", fontWeight: 500 }}>
              Lex Fridman Podcast
            </span>
            <span
              style={{
                fontSize: 16,
                color: "#d4d4d8",
                fontWeight: 600,
                lineHeight: 1.3,
              }}
            >
              Sam Altman: OpenAI, GPT-5 and the future of AI
            </span>
          </div>

          {/* Waveform player */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Play button */}
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                background: "#dc2626",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "7px solid transparent",
                  borderBottom: "7px solid transparent",
                  borderLeft: "12px solid #ffffff",
                  marginLeft: "3px",
                }}
              />
            </div>
            {/* Waveform bars */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "3px",
                height: "36px",
              }}
            >
              {BARS.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: "4px",
                    height: `${h * 0.56}px`,
                    background: i < 8 ? "#dc2626" : "rgba(255,255,255,0.2)",
                    borderRadius: "3px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Duration */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#dc2626",
              }}
            />
            <span style={{ fontSize: 14, color: "#52525b", fontWeight: 500 }}>
              2 min · saved 1h 45min
            </span>
          </div>
        </div>

        {/* Free badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(220,38,38,0.12)",
            border: "1px solid rgba(220,38,38,0.25)",
            borderRadius: "100px",
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 20,
            paddingRight: 20,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color: "#f87171" }}>
            Free for up to 5 channels
          </span>
        </div>
      </div>
    </div>,
    { ...size },
  );
}
