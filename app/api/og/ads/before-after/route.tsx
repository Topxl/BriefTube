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
  const fmt = (searchParams.get("format") ?? "landscape") as Format;
  const { width, height } = DIMS[fmt];
  const isLandscape = fmt === "landscape";
  const isVertical = !isLandscape;

  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallback = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallback);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const timePx = isLandscape ? 96 : 108;
  const labelPx = isLandscape ? 24 : 28;
  const descPx = isLandscape ? 20 : 24;
  const pad = isLandscape ? 52 : 72;

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
      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "0",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.12)",
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

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: isLandscape ? 40 : 56,
          paddingLeft: pad,
          paddingRight: pad,
          paddingBottom: isLandscape ? 32 : 48,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src={logoSrc}
            width={isLandscape ? 40 : 48}
            height={isLandscape ? 40 : 48}
            style={{ borderRadius: "10px" }}
          />
          <span
            style={{
              fontSize: isLandscape ? 26 : 32,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            BriefTube
          </span>
        </div>
        <div
          style={{
            fontSize: isLandscape ? 18 : 22,
            color: "#52525b",
            fontWeight: 500,
          }}
        >
          {SiteConfig.domain}
        </div>
      </div>

      {/* Split panels: row for landscape, column for square/portrait */}
      <div
        style={{
          display: "flex",
          flexDirection: isLandscape ? "row" : "column",
          flexGrow: 1,
          paddingTop: 0,
          paddingLeft: pad,
          paddingRight: pad,
          paddingBottom: isLandscape ? 40 : 60,
          gap: isLandscape ? "24px" : "20px",
        }}
      >
        {/* BEFORE panel */}
        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            display: "flex",
            /* landscape: column (badge top, number, label bottom) */
            /* vertical: row (text left, number right) */
            flexDirection: isLandscape ? "column" : "row",
            alignItems: "center",
            justifyContent: isLandscape ? "center" : "space-between",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px",
            paddingTop: isLandscape ? 32 : 36,
            paddingLeft: isLandscape ? 36 : 48,
            paddingRight: isLandscape ? 36 : 48,
            paddingBottom: isLandscape ? 32 : 36,
            gap: isLandscape ? "20px" : "0px",
          }}
        >
          {/* Left text block (landscape: stacked; vertical: left side) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: isLandscape ? "0px" : "10px",
              alignItems: isLandscape ? "flex-start" : "flex-start",
            }}
          >
            <span
              style={{
                fontSize: labelPx - 4,
                color: "#71717a",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              BEFORE
            </span>
            {isLandscape && (
              <div
                style={{
                  display: "flex",
                  marginTop: 16,
                  fontSize: timePx,
                  fontWeight: 900,
                  color: "#52525b",
                  letterSpacing: "-3px",
                  lineHeight: 1,
                }}
              >
                47 min
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                marginTop: isLandscape ? 16 : 0,
              }}
            >
              <span
                style={{ fontSize: labelPx, color: "#71717a", fontWeight: 700 }}
              >
                Watching the video
              </span>
              <span style={{ fontSize: descPx, color: "#3f3f46" }}>
                Sitting through ads, intros, padding...
              </span>
            </div>
          </div>

          {/* Large number: right side for vertical, below label for landscape */}
          {isVertical && (
            <div
              style={{
                display: "flex",
                fontSize: timePx,
                fontWeight: 900,
                color: "#52525b",
                letterSpacing: "-3px",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              47 min
            </div>
          )}
        </div>

        {/* Arrow */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: isLandscape ? 32 : 40,
              color: "#dc2626",
              fontWeight: 900,
            }}
          >
            {isLandscape ? "→" : "↓"}
          </div>
        </div>

        {/* AFTER panel */}
        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            display: "flex",
            flexDirection: isLandscape ? "column" : "row",
            alignItems: "center",
            justifyContent: isLandscape ? "center" : "space-between",
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
            borderRadius: "20px",
            paddingTop: isLandscape ? 32 : 36,
            paddingLeft: isLandscape ? 36 : 48,
            paddingRight: isLandscape ? 36 : 48,
            paddingBottom: isLandscape ? 32 : 36,
            gap: isLandscape ? "20px" : "0px",
          }}
        >
          {/* Left text block */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: isLandscape ? "0px" : "10px",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: labelPx - 4,
                color: "#f87171",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              AFTER
            </span>
            {isLandscape && (
              <div
                style={{
                  display: "flex",
                  marginTop: 16,
                  fontSize: timePx,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-3px",
                  lineHeight: 1,
                }}
              >
                4 min
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                marginTop: isLandscape ? 16 : 0,
              }}
            >
              <span
                style={{ fontSize: labelPx, color: "#e4e4e7", fontWeight: 700 }}
              >
                Listening in Telegram
              </span>
              <span style={{ fontSize: descPx, color: "#71717a" }}>
                AI summary delivered automatically
              </span>
            </div>
          </div>

          {/* Large number: right side for vertical */}
          {isVertical && (
            <div
              style={{
                display: "flex",
                fontSize: timePx,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: "-3px",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              4 min
            </div>
          )}
        </div>
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingBottom: isLandscape ? 36 : 52,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: isLandscape ? 20 : 26,
            color: "#52525b",
            fontWeight: 600,
            letterSpacing: "0.5px",
          }}
        >
          {`Same content. 90% less time. · Free ${SiteConfig.trialDays}-day trial`}
        </div>
      </div>
    </div>,
    { width, height },
  );
}
