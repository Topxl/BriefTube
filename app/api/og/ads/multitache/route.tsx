import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";
import { loadLogoBase64, OG_BARS } from "@/lib/og";

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

  const headlinePx = isLandscape ? 72 : 68;
  const subtitlePx = isLandscape ? 26 : 24;
  const topPad = isLandscape ? 48 : 60;
  const sidePad = isLandscape ? 56 : 64;
  const sectionGap = isLandscape ? 28 : 24;

  const activities = [
    {
      title: "While cooking",
      desc: "2 summaries in 20 min",
      color: "#22c55e",
      bars: [32, 48, 28, 44, 36],
    },
    {
      title: "While running",
      desc: "1 summary per km",
      color: "#f97316",
      bars: [40, 52, 36, 50, 44],
    },
    {
      title: "While driving",
      desc: "5 summaries per commute",
      color: "#3b82f6",
      bars: [44, 56, 32, 48, 40],
    },
  ];

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: isLandscape ? "row" : "column",
        justifyContent: "space-between",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glows */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.12)",
          filter: "blur(200px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: -80,
          left: -80,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
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

      {/* Header: Logo + Brand + Domain */}
      <div
        style={{
          position: "absolute",
          top: topPad,
          left: sidePad,
          right: sidePad,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src={logoSrc}
            width={40}
            height={40}
            style={{ borderRadius: "8px" }}
          />
          <span
            style={{
              fontSize: isLandscape ? 26 : 28,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            BriefTube
          </span>
        </div>
        <span
          style={{
            fontSize: isLandscape ? 18 : 16,
            color: "#52525b",
            fontWeight: 500,
          }}
        >
          {SiteConfig.domain}
        </span>
      </div>

      {/* Main content container */}
      <div
        style={{
          display: "flex",
          flexDirection: isLandscape ? "row" : "column",
          gap: isLandscape ? 40 : 24,
          paddingTop: isLandscape ? topPad : topPad + 60,
          paddingBottom: topPad,
          paddingLeft: sidePad,
          paddingRight: sidePad,
          flexGrow: 1,
          justifyContent: "space-between",
        }}
      >
        {/* Left section: Text + Cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: sectionGap,
            flex: 1,
          }}
        >
          {/* Headline */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: headlinePx,
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.1,
                letterSpacing: "-1px",
              }}
            >
              Cook. Run. Commute.
            </div>
            <div
              style={{
                fontSize: subtitlePx,
                color: "#71717a",
                lineHeight: 1.5,
                maxWidth: isLandscape ? "380px" : "100%",
              }}
            >
              Your brain learns while you live.
            </div>
          </div>

          {/* 3 Activity Cards */}
          <div
            style={{
              display: "flex",
              flexDirection: isLandscape ? "column" : "row",
              gap: isLandscape ? 12 : 10,
              marginTop: 4,
            }}
          >
            {activities.map((activity, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  paddingTop: 14,
                  paddingBottom: 14,
                  paddingLeft: 16,
                  paddingRight: 16,
                  flex: 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: activity.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#ffffff",
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: "#ffffff",
                      }}
                    >
                      {activity.title}
                    </span>
                    <span style={{ fontSize: 13, color: "#71717a" }}>
                      {activity.desc}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 2,
                    height: 24,
                  }}
                >
                  {activity.bars.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        width: 3,
                        height: h,
                        borderRadius: "1px",
                        background: "#dc2626",
                        flex: 1,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right section / Bottom: Player mock */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            flex: isLandscape ? 0 : 1,
            justifyContent: "flex-end",
          }}
        >
          {/* Player Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "16px",
              paddingTop: isLandscape ? 20 : 24,
              paddingBottom: isLandscape ? 20 : 24,
              paddingLeft: isLandscape ? 24 : 28,
              paddingRight: isLandscape ? 24 : 28,
              width: isLandscape ? "320px" : "100%",
            }}
          >
            {/* Player Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={logoSrc}
                width={44}
                height={44}
                style={{ borderRadius: "8px" }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  BriefTube
                </span>
                <span style={{ fontSize: 14, color: "#52525b" }}>
                  Now playing...
                </span>
              </div>
            </div>

            {/* Waveform */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 3,
              }}
            >
              {OG_BARS.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: h,
                    borderRadius: "1px",
                    background: i < 8 ? "#dc2626" : "rgba(255,255,255,0.15)",
                    flex: 1,
                  }}
                />
              ))}
            </div>

            {/* Duration + Title */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 14, color: "#71717a" }}>
                  Lex Fridman — Sam Altman
                </span>
              </div>
              <span style={{ fontSize: 16, color: "#71717a", fontWeight: 600 }}>
                4:12
              </span>
            </div>
          </div>

          {/* Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(220,38,38,0.12)",
              border: "1px solid rgba(220,38,38,0.25)",
              borderRadius: "100px",
              paddingTop: 8,
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 16,
              alignSelf: "flex-start",
            }}
          >
            <span style={{ fontSize: 16, color: "#f87171", fontWeight: 700 }}>
              Screen-free
            </span>
            <span style={{ fontSize: 14, color: "#71717a" }}>·</span>
            <span style={{ fontSize: 16, color: "#71717a", fontWeight: 500 }}>
              {SiteConfig.domain}
            </span>
          </div>
        </div>
      </div>
    </div>,
    { width, height },
  );
}
