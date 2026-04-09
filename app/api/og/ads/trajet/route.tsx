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

  const numberPx = isLandscape ? 72 : 84;
  const arrowPx = isLandscape ? 56 : 64;
  const headlinePx = isLandscape ? 28 : 36;
  const descPx = isLandscape ? 18 : 22;
  const badgePx = isLandscape ? 14 : 16;
  const pad = isLandscape ? 52 : 72;

  const badges = ["Cook", "Run", "Commute"];

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
      }}
    >
      {/* Red top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 5,
          background: "#dc2626",
        }}
      />

      {/* Header with logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          paddingTop: 40,
          paddingLeft: pad,
          paddingRight: pad,
          paddingBottom: 0,
          gap: 12,
        }}
      >
        <img
          src={logoSrc}
          width={40}
          height={40}
          style={{ borderRadius: "10px" }}
        />
        <span
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-0.5px",
          }}
        >
          BriefTube
        </span>
      </div>

      {/* Main content: split layout */}
      <div
        style={{
          display: "flex",
          flexDirection: isLandscape ? "row" : "column",
          flexGrow: 1,
          paddingTop: isLandscape ? 48 : 52,
          paddingLeft: pad,
          paddingRight: pad,
          paddingBottom: isLandscape ? 40 : 48,
          gap: isLandscape ? 40 : 32,
          alignItems: "center",
        }}
      >
        {/* Left/Top: equation and badges */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 32,
            flexGrow: 1,
            justifyContent: "center",
          }}
        >
          {/* Equation: 20 min → 5 résumés */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
            }}
          >
            <span
              style={{
                fontSize: numberPx,
                fontWeight: 900,
                color: "#3f3f46",
                letterSpacing: "-2px",
                lineHeight: 1,
              }}
            >
              20 min
            </span>
            <span
              style={{
                fontSize: arrowPx,
                color: "#dc2626",
                fontWeight: 900,
              }}
            >
              {"\u2192"}
            </span>
            <span
              style={{
                fontSize: numberPx,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-2px",
                lineHeight: 1,
              }}
            >
              5
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                style={{ fontSize: descPx, color: "#ffffff", fontWeight: 600 }}
              >
                summaries
              </span>
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                fontSize: headlinePx,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-1px",
                lineHeight: 1.3,
              }}
            >
              Your brain learns while you live.
            </div>
            <div
              style={{
                fontSize: descPx,
                color: "#52525b",
                fontWeight: 500,
              }}
            >
              AI audio summaries of your YouTube channels.
            </div>
          </div>

          {/* Badges */}
          <div
            style={{
              display: "flex",
              gap: 12,
            }}
          >
            {badges.map((badge) => (
              <div
                key={badge}
                style={{
                  background: "#dc2626",
                  paddingTop: 8,
                  paddingBottom: 8,
                  paddingLeft: 14,
                  paddingRight: 14,
                  borderRadius: "20px",
                  fontSize: badgePx,
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-0.5px",
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        </div>

        {/* Right/Bottom: Mock player card, WITHOUT progress bar for now */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            paddingTop: 20,
            paddingLeft: 20,
            paddingRight: 20,
            paddingBottom: 20,
            gap: 16,
            width: isLandscape ? 280 : "100%",
            flexShrink: 0,
          }}
        >
          {/* Player header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <img
              src={logoSrc}
              width={32}
              height={32}
              style={{ borderRadius: "8px" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                Lex Fridman
              </div>
              <div style={{ fontSize: 12, color: "#52525b" }}>Sam Altman</div>
            </div>
          </div>

          {/* Progress bar: flex-based, no position:relative/absolute */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                width: "100%",
                height: 6,
                background: "#3f3f46",
                borderRadius: "3px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: "40%",
                  height: 6,
                  background: "#dc2626",
                  borderRadius: "3px",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                fontSize: 12,
                color: "#52525b",
              }}
            >
              3:47
            </div>
          </div>
        </div>
      </div>

      {/* Bottom badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingBottom: isLandscape ? 32 : 48,
        }}
      >
        <div
          style={{
            background: "#dc2626",
            paddingTop: 8,
            paddingBottom: 8,
            paddingLeft: 16,
            paddingRight: 16,
            borderRadius: "20px",
            fontSize: badgePx,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {`Free · ${SiteConfig.domain}`}
        </div>
      </div>
    </div>,
    { width, height },
  );
}
