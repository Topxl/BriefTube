import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";
import { loadLogoBase64 } from "@/lib/og";

type Format = "landscape" | "g-square" | "g-portrait";

const DIMS: Record<Format, { width: number; height: number }> = {
  landscape: { width: 1200, height: 628 },
  "g-square": { width: 1200, height: 1200 },
  "g-portrait": { width: 960, height: 1200 },
};

const CHANNELS = [
  "Lex Fridman",
  "TED",
  "Y Combinator",
  "Fireship",
  "Kurzgesagt",
  "3Blue1Brown",
  "Veritasium",
  "MKBHD",
  "Ali Abdaal",
  "CGP Grey",
  "Wendover",
  "Tom Scott",
];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fmt = (searchParams.get("format") ?? "landscape") as Format;
  const { width, height } = DIMS[fmt];
  const isLandscape = fmt === "landscape";

  const logoSrc = loadLogoBase64();

  const gridCols = 3;
  const channelSize = isLandscape ? 15 : 20;
  const channelPad = isLandscape ? 8 : 18;
  const gapPx = isLandscape ? 12 : 10;

  const pad = isLandscape ? 52 : 72;
  const numberPx = isLandscape ? 96 : 108;
  const labelPx = isLandscape ? 24 : 28;
  const descPx = isLandscape ? 20 : 24;

  const activeIndices = [2, 5, 9];

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
          top: -100,
          right: 0,
          width: 400,
          height: 400,
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
          height: 5,
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
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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

      {/* Main content */}
      <div
        style={{
          display: "flex",
          flexDirection: isLandscape ? "row" : "column",
          flexGrow: 1,
          paddingLeft: pad,
          paddingRight: pad,
          paddingBottom: isLandscape ? 40 : 60,
          gap: isLandscape ? 40 : 32,
        }}
      >
        {/* Channels grid */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: gapPx,
            flexShrink: 0,
            flexGrow: isLandscape ? 0 : 1,
            width: isLandscape ? "45%" : "100%",
          }}
        >
          {[0, 1, 2].map((rowIdx) => (
            <div
              key={rowIdx}
              style={{
                display: "flex",
                gap: gapPx,
                flexGrow: isLandscape ? 0 : 1,
              }}
            >
              {CHANNELS.slice(
                rowIdx * gridCols,
                rowIdx * gridCols + gridCols,
              ).map((name, idx) => {
                const channelIdx = rowIdx * gridCols + idx;
                const isActive = activeIndices.includes(channelIdx);

                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      flex: 1,
                      overflow: "hidden",
                      fontSize: channelSize,
                      fontWeight: 600,
                      paddingTop: channelPad,
                      paddingBottom: channelPad,
                      paddingLeft: 10,
                      paddingRight: 10,
                      borderRadius: 8,
                      background: isActive
                        ? "rgba(220,38,38,0.15)"
                        : "rgba(255,255,255,0.08)",
                      border: isActive
                        ? "1px solid rgba(220,38,38,0.3)"
                        : "1px solid rgba(255,255,255,0.05)",
                      color: isActive ? "#f87171" : "#3f3f46",
                    }}
                  >
                    {isActive && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#22c55e",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden" }}>
                      {name}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Text section */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: isLandscape ? 20 : 24,
            flexGrow: isLandscape ? 1 : 0,
          }}
        >
          {/* Main tagline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: numberPx,
                  fontWeight: 900,
                  color: "#ffffff",
                  letterSpacing: "-3px",
                  lineHeight: 1,
                }}
              >
                40
              </span>
              <span
                style={{
                  fontSize: labelPx,
                  fontWeight: 600,
                  color: "#a1a1a6",
                }}
              >
                channels subscribed
              </span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: numberPx,
                  fontWeight: 900,
                  color: "#3f3f46",
                  letterSpacing: "-3px",
                  lineHeight: 1,
                }}
              >
                3
              </span>
              <span
                style={{
                  fontSize: labelPx,
                  fontWeight: 600,
                  color: "#a1a1a6",
                }}
              >
                actually followed
              </span>
            </div>
          </div>

          {/* Red highlight line */}
          <div
            style={{
              fontSize: labelPx + 2,
              fontWeight: 700,
              color: "#dc2626",
              lineHeight: 1.3,
              maxWidth: "100%",
            }}
          >
            BriefTube keeps you up with all the others.
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: descPx,
              color: "#52525b",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            Automatic audio summary as soon as a video drops.
          </div>
        </div>
      </div>

      {/* Bottom badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingBottom: isLandscape ? 36 : 52,
        }}
      >
        <div
          style={{
            fontSize: isLandscape ? 20 : 26,
            color: "#52525b",
            fontWeight: 600,
            letterSpacing: "0.5px",
          }}
        >
          {`Free · ${SiteConfig.domain}`}
        </div>
      </div>
    </div>,
    { width, height },
  );
}
