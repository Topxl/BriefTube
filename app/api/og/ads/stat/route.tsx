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

  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallback = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallback);
  const logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const bigPx = isLandscape ? 100 : 130;
  const arrowPx = isLandscape ? 80 : 108;
  const subPx = isLandscape ? 26 : 34;
  const descPx = isLandscape ? 20 : 26;

  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
        padding: isLandscape ? "52px 80px" : "80px",
      }}
    >
      {/* Large red background circle — decorative */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isLandscape ? "700px" : "860px",
          height: isLandscape ? "700px" : "860px",
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

      {/* Main number display */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: isLandscape ? "32px" : "24px",
          marginBottom: isLandscape ? "32px" : "48px",
        }}
      >
        {/* Before */}
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

        {/* Arrow */}
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

        {/* After */}
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
          width: "60px",
          height: "3px",
          background: "rgba(220,38,38,0.4)",
          borderRadius: "2px",
          marginBottom: isLandscape ? "28px" : "44px",
        }}
      />

      {/* Subtitle lines */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          marginBottom: isLandscape ? "32px" : "52px",
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
        <div style={{ fontSize: descPx, color: "#71717a", fontWeight: 500 }}>
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
          padding: isLandscape ? "12px 28px" : "14px 32px",
        }}
      >
        <img
          src={logoSrc}
          width={isLandscape ? 32 : 40}
          height={isLandscape ? 32 : 40}
          style={{ borderRadius: "8px" }}
        />
        <span
          style={{
            fontSize: isLandscape ? 22 : 28,
            fontWeight: 800,
            color: "#ffffff",
          }}
        >
          BriefTube
        </span>
        <span style={{ fontSize: isLandscape ? 16 : 20, color: "#52525b" }}>
          ·
        </span>
        <span
          style={{
            fontSize: isLandscape ? 16 : 20,
            color: "#52525b",
            fontWeight: 500,
          }}
        >
          Free {SiteConfig.trialDays}-day trial · {SiteConfig.domain}
        </span>
      </div>
    </div>,
    { width, height },
  );
}
