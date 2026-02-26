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

  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallback = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallback);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const timePx = isLandscape ? 96 : 120;
  const labelPx = isLandscape ? 24 : 30;
  const descPx = isLandscape ? 20 : 26;
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
        overflow: "hidden",
      }}
    >
      {/* Background glows */}
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
          padding: `${isLandscape ? 40 : 56}px ${pad}px ${isLandscape ? 32 : 48}px`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img
            src={logoSrc}
            width={isLandscape ? 40 : 50}
            height={isLandscape ? 40 : 50}
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

      {/* Main split layout */}
      <div
        style={{
          display: "flex",
          flex: 1,
          padding: `0 ${pad}px ${isLandscape ? 40 : 60}px`,
          gap: "24px",
        }}
      >
        {/* BEFORE panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px",
            padding: isLandscape ? "32px 36px" : "48px 44px",
            gap: isLandscape ? "20px" : "28px",
            position: "relative",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "100px",
              padding: "6px 18px",
            }}
          >
            <span
              style={{
                fontSize: labelPx - 4,
                color: "#71717a",
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              Before
            </span>
          </div>

          {/* Icon */}
          <div style={{ fontSize: isLandscape ? 52 : 72 }}>📺</div>

          {/* Time */}
          <div
            style={{
              fontSize: timePx,
              fontWeight: 900,
              color: "#52525b",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            47 min
          </div>

          {/* Labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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

        {/* Center arrow */}
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
              fontSize: isLandscape ? 32 : 44,
              color: "#dc2626",
              fontWeight: 900,
            }}
          >
            →
          </div>
        </div>

        {/* AFTER panel */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
            borderRadius: "20px",
            padding: isLandscape ? "32px 36px" : "48px 44px",
            gap: isLandscape ? "20px" : "28px",
            position: "relative",
          }}
        >
          {/* Badge */}
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: "rgba(220,38,38,0.15)",
              border: "1px solid rgba(220,38,38,0.3)",
              borderRadius: "100px",
              padding: "6px 18px",
            }}
          >
            <span
              style={{
                fontSize: labelPx - 4,
                color: "#f87171",
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              After
            </span>
          </div>

          {/* Icon */}
          <div style={{ fontSize: isLandscape ? 52 : 72 }}>🎧</div>

          {/* Time */}
          <div
            style={{
              fontSize: timePx,
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-3px",
              lineHeight: 1,
            }}
          >
            4 min
          </div>

          {/* Labels */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
            fontSize: isLandscape ? 20 : 26,
            color: "#52525b",
            fontWeight: 600,
            letterSpacing: "0.5px",
          }}
        >
          Same content. 90% less time. · Free {SiteConfig.trialDays}-day trial
        </div>
      </div>
    </div>,
    { width, height },
  );
}
