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

  const pxBig = isLandscape ? 110 : isPortrait ? 160 : 140;
  const pxArrow = isLandscape ? 80 : isPortrait ? 130 : 116;
  const pxSub = isLandscape ? 26 : isPortrait ? 40 : 36;
  const pxDesc = isLandscape ? 20 : isPortrait ? 30 : 26;
  const pxTag = isLandscape ? 18 : isPortrait ? 26 : 22;
  const pad = 80;

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
      {/* Large red background circle: decorative glow */}
      <div
        style={{
          position: "absolute",
          top: -86,
          left: -86,
          width: isLandscape ? 700 : 900,
          height: isLandscape ? 700 : 900,
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
          filter: "blur(100px)",
        }}
      />

      {/* Top accent bar */}
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

      {isLandscape ? (
        /* LANDSCAPE: centered layout */
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
          {/* Logo and branding row, top */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 48,
              position: "absolute",
              top: 20,
              left: pad,
            }}
          >
            <img
              src={logoSrc}
              width={40}
              height={40}
              style={{ borderRadius: "8px" }}
            />
            <span
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: "#3f3f46",
                letterSpacing: "-0.5px",
              }}
            >
              BriefTube
            </span>
          </div>

          {/* Main numbers + arrow block */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 48,
              marginBottom: 52,
            }}
          >
            {/* Left: 1h47 with strikethrough line */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* display:flex required on position:relative parent for absolute children */}
              <div
                style={{
                  display: "flex",
                  position: "relative",
                  fontSize: pxBig,
                  fontWeight: 900,
                  color: "#3f3f46",
                  letterSpacing: "-4px",
                  lineHeight: 1,
                }}
              >
                1h47
                {/* Red strikethrough line */}
                <div
                  style={{
                    position: "absolute",
                    top: 45,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: "#dc2626",
                    borderRadius: "2px",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: pxDesc,
                  color: "#3f3f46",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                of video watched
              </span>
            </div>

            {/* Arrow */}
            <div
              style={{
                fontSize: pxArrow,
                fontWeight: 900,
                color: "#dc2626",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              {"\u2192"}
            </div>

            {/* Right: 6 min in white */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  fontSize: pxBig,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-4px",
                  lineHeight: 1,
                }}
              >
                6 min
              </div>
              <span
                style={{
                  fontSize: pxDesc,
                  color: "#dc2626",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                audio summary
              </span>
            </div>
          </div>

          {/* Divider line */}
          <div
            style={{
              display: "flex",
              width: 80,
              height: 3,
              background: "#dc2626",
              borderRadius: "2px",
              marginBottom: 28,
            }}
          />

          {/* Tagline: flex+center instead of textAlign:center */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              fontSize: pxSub,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.5px",
              marginBottom: 48,
              maxWidth: 600,
            }}
          >
            Same content. No time wasted.
          </div>

          {/* Bottom badge */}
          <div
            style={{
              position: "absolute",
              bottom: 28,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "100px",
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 24,
                paddingRight: 24,
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
                  fontSize: pxTag,
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                BriefTube
              </span>
              <span style={{ fontSize: pxTag, color: "#52525b" }}>
                {"\u00b7"}
              </span>
              <span
                style={{
                  fontSize: pxTag,
                  color: "#52525b",
                  fontWeight: 500,
                }}
              >{`Free · ${SiteConfig.domain}`}</span>
            </div>
          </div>
        </div>
      ) : (
        /* SQUARE / PORTRAIT: top + center + bottom layout */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
          }}
        >
          {/* Top header: Logo + domain */}
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
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <img
                src={logoSrc}
                width={48}
                height={48}
                style={{ borderRadius: "12px" }}
              />
              <span
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: "#3f3f46",
                  letterSpacing: "-0.5px",
                }}
              >
                BriefTube
              </span>
            </div>
          </div>

          {/* Center: main numbers + tagline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexGrow: 1,
              paddingLeft: pad,
              paddingRight: pad,
              gap: 0,
            }}
          >
            {/* Numbers row */}
            <div
              style={{
                display: "flex",
                flexDirection: isPortrait ? "column" : "row",
                alignItems: "center",
                gap: isPortrait ? 32 : 48,
                marginBottom: isPortrait ? 64 : 52,
              }}
            >
              {/* Left: 1h47 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {/* display:flex required on position:relative parent for absolute children */}
                <div
                  style={{
                    display: "flex",
                    position: "relative",
                    fontSize: pxBig,
                    fontWeight: 900,
                    color: "#3f3f46",
                    letterSpacing: "-4px",
                    lineHeight: 1,
                  }}
                >
                  1h47
                  {/* Red strikethrough line */}
                  <div
                    style={{
                      position: "absolute",
                      top: 55,
                      left: 0,
                      right: 0,
                      height: 4,
                      background: "#dc2626",
                      borderRadius: "2px",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: pxDesc,
                    color: "#3f3f46",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}
                >
                  of video
                </span>
              </div>

              {/* Arrow */}
              <div
                style={{
                  fontSize: pxArrow,
                  fontWeight: 900,
                  color: "#dc2626",
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                {isPortrait ? "\u2193" : "\u2192"}
              </div>

              {/* Right: 6 min */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: pxBig,
                    fontWeight: 900,
                    color: "#ffffff",
                    letterSpacing: "-4px",
                    lineHeight: 1,
                  }}
                >
                  6 min
                </div>
                <span
                  style={{
                    fontSize: pxDesc,
                    color: "#dc2626",
                    fontWeight: 600,
                    letterSpacing: "0.5px",
                  }}
                >
                  audio summary
                </span>
              </div>
            </div>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                width: 80,
                height: 3,
                background: "#dc2626",
                borderRadius: "2px",
                marginBottom: isPortrait ? 56 : 48,
              }}
            />

            {/* Tagline: flex+center instead of textAlign:center */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                fontSize: pxSub,
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.5px",
                maxWidth: 500,
              }}
            >
              Same content. No time wasted.
            </div>
          </div>

          {/* Bottom: brand badge */}
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
                gap: 12,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "100px",
                paddingTop: 14,
                paddingBottom: 14,
                paddingLeft: 28,
                paddingRight: 28,
              }}
            >
              <img
                src={logoSrc}
                width={40}
                height={40}
                style={{ borderRadius: "8px" }}
              />
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: "#ffffff",
                }}
              >
                BriefTube
              </span>
              <span style={{ fontSize: 20, color: "#52525b" }}>{"\u00b7"}</span>
              <span
                style={{
                  fontSize: 20,
                  color: "#52525b",
                  fontWeight: 500,
                }}
              >{`Free · ${SiteConfig.domain}`}</span>
            </div>
          </div>
        </div>
      )}
    </div>,
    { width, height },
  );
}
