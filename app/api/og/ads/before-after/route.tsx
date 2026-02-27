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
  const pad = isLandscape ? 52 : 72;

  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallback = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallback);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

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
            width={40}
            height={40}
            style={{ borderRadius: "10px" }}
          />
          <span style={{ fontSize: 26, fontWeight: 800, color: "#ffffff" }}>
            BriefTube
          </span>
        </div>
        <div style={{ fontSize: 18, color: "#52525b" }}>
          {SiteConfig.domain}
        </div>
      </div>

      {/* Split panels */}
      <div
        style={{
          display: "flex",
          flexGrow: 1,
          paddingTop: 0,
          paddingLeft: pad,
          paddingRight: pad,
          paddingBottom: isLandscape ? 40 : 60,
          gap: "24px",
        }}
      >
        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "20px",
            paddingTop: 32,
            paddingLeft: 36,
            paddingRight: 36,
            paddingBottom: 32,
            gap: "20px",
          }}
        >
          <span style={{ fontSize: 20, color: "#71717a", fontWeight: 700 }}>
            BEFORE
          </span>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: "#52525b",
              lineHeight: 1,
            }}
          >
            47 min
          </div>
          <span style={{ fontSize: 22, color: "#71717a", fontWeight: 700 }}>
            Watching the video
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: 32, color: "#dc2626", fontWeight: 900 }}>
            →
          </div>
        </div>

        <div
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.2)",
            borderRadius: "20px",
            paddingTop: 32,
            paddingLeft: 36,
            paddingRight: 36,
            paddingBottom: 32,
            gap: "20px",
          }}
        >
          <span style={{ fontSize: 20, color: "#f87171", fontWeight: 700 }}>
            AFTER
          </span>
          <div
            style={{
              fontSize: 96,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1,
            }}
          >
            4 min
          </div>
          <span style={{ fontSize: 22, color: "#e4e4e7", fontWeight: 700 }}>
            Listening in Telegram
          </span>
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
