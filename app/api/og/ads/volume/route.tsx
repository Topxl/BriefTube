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
  const isPortrait = fmt === "g-portrait";

  const logoSrc = loadLogoBase64();

  const bigNum = isLandscape ? 120 : isPortrait ? 180 : 160;
  const smallNum = isLandscape ? 100 : isPortrait ? 140 : 130;
  const labelPx = isLandscape ? 24 : isPortrait ? 36 : 32;
  const captionPx = isLandscape ? 18 : isPortrait ? 28 : 24;
  const taglinePx = isLandscape ? 32 : isPortrait ? 48 : 44;
  const pad = isLandscape ? 60 : 56;

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
      {/* Large red background circle — decorative glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isLandscape ? "600px" : "800px",
          height: isLandscape ? "600px" : "800px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
          filter: "blur(120px)",
        }}
      />

      {/* Top accent bar */}
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

      {/* Header for portrait/square layouts */}
      {!isLandscape && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 48,
            paddingLeft: pad,
            paddingRight: pad,
            paddingBottom: 40,
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img
              src={logoSrc}
              width={isPortrait ? 48 : 40}
              height={isPortrait ? 48 : 40}
              style={{ borderRadius: "10px" }}
            />
            <span
              style={{
                fontSize: isPortrait ? 32 : 28,
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
              fontSize: isPortrait ? 22 : 20,
              color: "#52525b",
              fontWeight: 500,
            }}
          >
            {SiteConfig.domain}
          </div>
        </div>
      )}

      {/* Main content container */}
      <div
        style={{
          display: "flex",
          flexDirection: isLandscape ? "row" : "column",
          alignItems: "center",
          justifyContent: isLandscape ? "space-between" : "center",
          flex: 1,
          paddingTop: isLandscape ? pad : 0,
          paddingBottom: isLandscape ? pad : isPortrait ? 80 : 60,
          paddingLeft: pad,
          paddingRight: pad,
          gap: isLandscape ? 80 : 60,
        }}
      >
        {/* Left section: Numbers contrast (landscape left, portrait top) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: isLandscape ? 24 : 32,
            flex: isLandscape ? 1 : "none",
            width: !isLandscape ? "100%" : "auto",
          }}
        >
          {/* Big number: 50+ */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: bigNum,
                fontWeight: 900,
                color: "#3f3f46",
                letterSpacing: "-3px",
                lineHeight: 1,
              }}
            >
              50+
            </div>
            <span
              style={{
                fontSize: labelPx,
                color: "#52525b",
                fontWeight: 600,
                letterSpacing: "0.5px",
              }}
            >
              new videos this week
            </span>
          </div>

          {/* Separator/arrow */}
          <div
            style={{
              fontSize: isLandscape ? 60 : 48,
              fontWeight: 900,
              color: "#dc2626",
              lineHeight: 1,
            }}
          >
            {isLandscape ? "→" : "↓"}
          </div>

          {/* Red zero: 0 */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: smallNum,
                fontWeight: 900,
                color: "#dc2626",
                letterSpacing: "-3px",
                lineHeight: 1,
              }}
            >
              0
            </div>
            <span
              style={{
                fontSize: labelPx,
                color: "#71717a",
                fontWeight: 600,
                letterSpacing: "0.5px",
              }}
            >
              watched
            </span>
          </div>

          {/* Transformation line */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
              marginTop: "12px",
            }}
          >
            <span
              style={{
                fontSize: captionPx,
                color: "#71717a",
                fontWeight: 500,
                letterSpacing: "0.3px",
              }}
            >
              With BriefTube:
            </span>
            <div
              style={{
                fontSize: taglinePx,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.5px",
                textAlign: "center",
              }}
            >
              You follow everything. In 4 min per video.
            </div>
          </div>
        </div>

        {/* Right section: BriefTube card (landscape right, portrait bottom) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            background: "rgba(15, 15, 15, 0.6)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: isLandscape ? "24px 28px" : "28px 32px",
            flex: isLandscape ? "0 0 auto" : "none",
            width: !isLandscape ? "100%" : "320px",
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <img
              src={logoSrc}
              width={28}
              height={28}
              style={{ borderRadius: "6px" }}
            />
            <span
              style={{
                fontSize: isLandscape ? 18 : 22,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.3px",
              }}
            >
              BriefTube
            </span>
          </div>

          {/* Fake video list */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {[1, 2, 3, 4].map((i) => {
              const widths = ["85%", "75%", "90%", "80%"];
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      height: isLandscape ? "8px" : "10px",
                      background: "#3f3f46",
                      borderRadius: "4px",
                      width: widths[i - 1],
                    }}
                  />
                  <div
                    style={{
                      width: isLandscape ? "6px" : "8px",
                      height: isLandscape ? "6px" : "8px",
                      borderRadius: "3px",
                      background: "#dc2626",
                      flexShrink: 0,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Card badge */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "8px",
            }}
          >
            <span
              style={{
                fontSize: isLandscape ? 14 : 16,
                color: "#dc2626",
                fontWeight: 600,
                letterSpacing: "0.3px",
              }}
            >
              Free · {SiteConfig.domain}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom header for landscape */}
      {isLandscape && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            left: "60px",
            right: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img
              src={logoSrc}
              width={32}
              height={32}
              style={{ borderRadius: "8px" }}
            />
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.3px",
              }}
            >
              BriefTube
            </span>
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#52525b",
              fontWeight: 500,
            }}
          >
            {SiteConfig.domain}
          </div>
        </div>
      )}
    </div>,
    { width, height },
  );
}
