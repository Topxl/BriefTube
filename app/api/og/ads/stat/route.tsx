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
  const isPortrait = fmt === "portrait";

  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallback = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallback);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const bigPx = isLandscape ? 100 : isPortrait ? 160 : 140;
  const arrowPx = isLandscape ? 80 : isPortrait ? 130 : 116;
  const subPx = isLandscape ? 26 : isPortrait ? 40 : 36;
  const descPx = isLandscape ? 20 : isPortrait ? 30 : 26;
  const pad = isLandscape ? 80 : 80;

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
      {/* Large red background circle: decorative */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isLandscape ? "700px" : "900px",
          height: isLandscape ? "700px" : "900px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
          filter: "blur(100px)",
        }}
      />

      {/* Top accent */}
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

      {/* For landscape: single centered block. For square/portrait: top-center-bottom structure */}
      {isLandscape ? (
        /* ── LANDSCAPE: original centered layout ── */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
            paddingTop: 52,
            paddingBottom: 52,
            paddingLeft: pad,
            paddingRight: pad,
          }}
        >
          {/* Numbers row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
              marginBottom: "32px",
            }}
          >
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
                  fontSize: bigPx,
                  fontWeight: 900,
                  color: "#3f3f46",
                  letterSpacing: "-4px",
                  lineHeight: 1,
                }}
              >
                47 min
              </div>
              <span
                style={{
                  fontSize: descPx,
                  color: "#3f3f46",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                watching YouTube
              </span>
            </div>
            <div
              style={{
                fontSize: arrowPx,
                fontWeight: 900,
                color: "#dc2626",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              →
            </div>
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
                  fontSize: bigPx,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-4px",
                  lineHeight: 1,
                }}
              >
                4 min
              </div>
              <span
                style={{
                  fontSize: descPx,
                  color: "#dc2626",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                listening in Telegram
              </span>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              width: "60px",
              height: "3px",
              background: "rgba(220,38,38,0.4)",
              borderRadius: "2px",
              marginBottom: "28px",
            }}
          />

          {/* Subtitle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                fontSize: subPx,
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.5px",
              }}
            >
              Every YouTube video. Summarized by AI.
            </div>
            <div
              style={{
                display: "flex",
                fontSize: descPx,
                color: "#71717a",
                fontWeight: 500,
              }}
            >
              Delivered as audio directly to your Telegram.
            </div>
          </div>

          {/* Brand row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "100px",
              paddingTop: 12,
              paddingBottom: 12,
              paddingLeft: 28,
              paddingRight: 28,
            }}
          >
            <img
              src={logoSrc}
              width={32}
              height={32}
              style={{ borderRadius: "8px" }}
            />
            <span style={{ fontSize: 22, fontWeight: 800, color: "#ffffff" }}>
              BriefTube
            </span>
            <span style={{ fontSize: 16, color: "#52525b" }}>·</span>
            <span
              style={{ fontSize: 16, color: "#52525b", fontWeight: 500 }}
            >{`Free ${SiteConfig.trialDays}-day trial · ${SiteConfig.domain}`}</span>
          </div>
        </div>
      ) : (
        /* ── SQUARE / PORTRAIT: top header + center numbers + bottom brand ── */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
          }}
        >
          {/* Top header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: 56,
              paddingLeft: pad,
              paddingRight: pad,
              paddingBottom: 48,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <img
                src={logoSrc}
                width={48}
                height={48}
                style={{ borderRadius: "12px" }}
              />
              <span
                style={{
                  fontSize: 34,
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
                display: "flex",
                fontSize: 24,
                color: "#52525b",
                fontWeight: 500,
              }}
            >
              {SiteConfig.domain}
            </div>
          </div>

          {/* Center: numbers + subtitle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
              paddingLeft: pad,
              paddingRight: pad,
              gap: "0px",
            }}
          >
            {/* Numbers row */}
            <div
              style={{
                display: "flex",
                flexDirection: isPortrait ? "column" : "row",
                alignItems: "center",
                gap: isPortrait ? "24px" : "28px",
                marginBottom: isPortrait ? "56px" : "48px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: bigPx,
                    fontWeight: 900,
                    color: "#3f3f46",
                    letterSpacing: "-4px",
                    lineHeight: 1,
                  }}
                >
                  47 min
                </div>
                <span
                  style={{
                    fontSize: descPx,
                    color: "#3f3f46",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}
                >
                  watching YouTube
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: arrowPx,
                  fontWeight: 900,
                  color: "#dc2626",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {isPortrait ? "↓" : "→"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: bigPx,
                    fontWeight: 900,
                    color: "#ffffff",
                    letterSpacing: "-4px",
                    lineHeight: 1,
                  }}
                >
                  4 min
                </div>
                <span
                  style={{
                    fontSize: descPx,
                    color: "#dc2626",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}
                >
                  listening in Telegram
                </span>
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                width: "60px",
                height: "3px",
                background: "rgba(220,38,38,0.4)",
                borderRadius: "2px",
                marginBottom: isPortrait ? "52px" : "44px",
              }}
            />

            {/* Subtitle */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: subPx,
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.5px",
                }}
              >
                Every YouTube video. Summarized by AI.
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: descPx,
                  color: "#71717a",
                  fontWeight: 500,
                }}
              >
                Delivered as audio directly to your Telegram.
              </div>
            </div>
          </div>

          {/* Bottom brand */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingBottom: 60,
              paddingTop: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "100px",
                paddingTop: 14,
                paddingBottom: 14,
                paddingLeft: 32,
                paddingRight: 32,
              }}
            >
              <img
                src={logoSrc}
                width={40}
                height={40}
                style={{ borderRadius: "8px" }}
              />
              <span style={{ fontSize: 28, fontWeight: 800, color: "#ffffff" }}>
                BriefTube
              </span>
              <span style={{ fontSize: 20, color: "#52525b" }}>·</span>
              <span
                style={{
                  display: "flex",
                  fontSize: 20,
                  color: "#52525b",
                  fontWeight: 500,
                }}
              >{`Free ${SiteConfig.trialDays}-day trial · ${SiteConfig.domain}`}</span>
            </div>
          </div>
        </div>
      )}
    </div>,
    { width, height },
  );
}
