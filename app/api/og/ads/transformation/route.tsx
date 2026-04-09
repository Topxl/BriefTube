import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";
import { loadLogoBase64 } from "@/lib/og";

type Format = "landscape" | "g-square" | "g-portrait";

const DIMS: Record<Format, { width: number; height: number }> = {
  landscape: { width: 1200, height: 628 },
  "g-square": { width: 1200, height: 1200 },
  "g-portrait": { width: 960, height: 1200 },
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fmt = (searchParams.get("format") ?? "landscape") as Format;
  const { width, height } = DIMS[fmt];
  const isLandscape = fmt === "landscape";

  const logoSrc = loadLogoBase64();

  // Font sizes adapt to format
  const headlinePx = isLandscape ? 85 : 100;
  const subtitlePx = isLandscape ? 24 : 26;
  const brandPx = isLandscape ? 18 : 20;
  const badgePx = isLandscape ? 18 : 20;

  // Spacing
  const mainGap = isLandscape ? 24 : 32;
  const separatorGap = isLandscape ? 20 : 28;

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
        padding: "60px",
      }}
    >
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

      {/* Subtle red glow top-right */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-100px",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
          filter: "blur(120px)",
        }}
      />

      {/* Main content wrapper */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: mainGap,
          textAlign: "center",
          maxWidth: "100%",
        }}
      >
        {/* Logo + brand at top */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src={logoSrc}
            width={isLandscape ? 48 : 56}
            height={isLandscape ? 48 : 56}
            style={{ borderRadius: "10px" }}
          />
          <span
            style={{
              fontSize: brandPx,
              fontWeight: 700,
              color: "#71717a",
              letterSpacing: "-0.5px",
            }}
          >
            BriefTube
          </span>
        </div>

        {/* Main headline: 4 lines */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0px" }}>
          {/* Line 1: "Stop watching" */}
          <div
            style={{
              fontSize: headlinePx,
              fontWeight: 900,
              color: "#3f3f46",
              lineHeight: 1.0,
              letterSpacing: "-2px",
            }}
          >
            Stop watching
          </div>

          {/* Line 2: "YouTube." */}
          <div
            style={{
              fontSize: headlinePx,
              fontWeight: 900,
              color: "#52525b",
              lineHeight: 1.0,
              letterSpacing: "-2px",
            }}
          >
            YouTube.
          </div>

          {/* Red separator */}
          <div
            style={{
              height: "3px",
              width: "60px",
              background: "#dc2626",
              margin: `${separatorGap}px auto`,
            }}
          />

          {/* Line 3: "Start learning" */}
          <div
            style={{
              fontSize: headlinePx,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.0,
              letterSpacing: "-2px",
            }}
          >
            Start learning
          </div>

          {/* Line 4: "from it." */}
          <div
            style={{
              fontSize: headlinePx,
              fontWeight: 900,
              color: "#dc2626",
              lineHeight: 1.0,
              letterSpacing: "-2px",
            }}
          >
            from it.
          </div>
        </div>

        {/* Subtitle below main text */}
        <div
          style={{
            fontSize: subtitlePx,
            color: "#52525b",
            fontWeight: 500,
            lineHeight: 1.4,
            marginTop: mainGap,
          }}
        >
          AI audio summaries of your favorite channels.
        </div>

        {/* Bottom badge pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(220, 38, 38, 0.12)",
            border: "1px solid rgba(220, 38, 38, 0.25)",
            borderRadius: "100px",
            paddingTop: "10px",
            paddingBottom: "10px",
            paddingLeft: "24px",
            paddingRight: "24px",
            marginTop: mainGap + 12,
          }}
        >
          <span
            style={{
              fontSize: badgePx,
              color: "#f87171",
              fontWeight: 700,
            }}
          >
            Free · ${SiteConfig.freeChannelsLimit} channels included
          </span>
          <span style={{ fontSize: badgePx, color: "#71717a" }}>·</span>
          <span
            style={{
              fontSize: badgePx,
              color: "#71717a",
              fontWeight: 500,
            }}
          >
            {SiteConfig.domain}
          </span>
        </div>
      </div>
    </div>,
    { width, height },
  );
}
