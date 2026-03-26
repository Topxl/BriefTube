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
  const isVertical = !isLandscape;

  const logoSrc = loadLogoBase64();

  const timePx = isLandscape ? 96 : 108;
  const labelPx = isLandscape ? 24 : 28;
  const descPx = isLandscape ? 20 : 24;
  const pad = isLandscape ? 52 : 72;

  // Waveform bars for audio visualization
  const waveformBars = [18, 32, 52, 64, 44, 58];
  const barWidth = isLandscape ? 6 : 8;
  const barGap = isLandscape ? 4 : 5;
  const maxBarHeight = isLandscape ? 48 : 56;

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

      {/* Split panels — row for landscape, column for square/portrait */}
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
        {/* EUX panel — muted */}
        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            display: "flex",
            flexDirection: isLandscape ? "column" : "row",
            alignItems: "center",
            justifyContent: isLandscape ? "center" : "space-between",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
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
                color: "#3f3f46",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              THEM
            </span>
            {isLandscape && (
              <div
                style={{
                  display: "flex",
                  marginTop: 16,
                  fontSize: timePx,
                  fontWeight: 900,
                  color: "#3f3f46",
                  letterSpacing: "-3px",
                  lineHeight: 1,
                }}
              >
                2h of video
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
                style={{ fontSize: labelPx, color: "#3f3f46", fontWeight: 700 }}
              >
                Watched
              </span>
              <span style={{ fontSize: descPx, color: "#2d2d2f" }}>
                tonight
              </span>
            </div>
          </div>

          {/* Large number — right side for vertical */}
          {isVertical && (
            <div
              style={{
                display: "flex",
                fontSize: timePx,
                fontWeight: 900,
                color: "#3f3f46",
                letterSpacing: "-3px",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              2h
            </div>
          )}

          {/* TV/screen icon */}
          {isLandscape && (
            <div
              style={{
                display: "flex",
                width: "120px",
                height: "80px",
                border: "2px solid rgba(63, 63, 70, 0.3)",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.2)",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: "8px",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  width: "90%",
                  height: "60%",
                  background: "rgba(63, 63, 70, 0.2)",
                  borderRadius: "4px",
                }}
              />
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

        {/* TOI panel — vivid */}
        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            display: "flex",
            flexDirection: isLandscape ? "column" : "row",
            alignItems: "center",
            justifyContent: isLandscape ? "center" : "space-between",
            background: "rgba(220,38,38,0.07)",
            border: "1px solid rgba(220,38,38,0.2)",
            borderRadius: "20px",
            paddingTop: isLandscape ? 32 : 36,
            paddingLeft: isLandscape ? 36 : 48,
            paddingRight: isLandscape ? 36 : 48,
            paddingBottom: isLandscape ? 32 : 36,
            gap: isLandscape ? "20px" : "0px",
            position: "relative",
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
              YOU
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
                10 summaries
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
                Listened
              </span>
              <span style={{ fontSize: descPx, color: "#dc2626" }}>
                in that time
              </span>
            </div>
          </div>

          {/* Large number — right side for vertical */}
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
              10
            </div>
          )}

          {/* Waveform audio bars */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              gap: `${barGap}px`,
              marginTop: isLandscape ? "16px" : "0px",
              height: `${maxBarHeight}px`,
            }}
          >
            {waveformBars.map((barHeight, idx) => (
              <div
                key={idx}
                style={{
                  width: `${barWidth}px`,
                  height: `${(barHeight / 64) * maxBarHeight}px`,
                  background: "#dc2626",
                  borderRadius: "3px",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: isLandscape ? "12px" : "16px",
          paddingBottom: isLandscape ? 36 : 52,
        }}
      >
        <div
          style={{
            fontSize: isLandscape ? 24 : 32,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-1px",
            lineHeight: 1.2,
            textAlign: "center",
          }}
        >
          Learn more. In less time.
        </div>
        <div
          style={{
            fontSize: isLandscape ? 16 : 20,
            color: "#52525b",
            fontWeight: 500,
          }}
        >
          {`BriefTube · Free · ${SiteConfig.domain}`}
        </div>
      </div>
    </div>,
    { width, height },
  );
}
