import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";
import { loadLogoBase64 } from "@/lib/og";

type Format = "landscape" | "g-square" | "g-portrait";

const DIMS: Record<Format, { width: number; height: number }> = {
  landscape: { width: 1200, height: 628 },
  "g-square": { width: 1200, height: 1200 },
  "g-portrait": { width: 960, height: 1200 },
};

// Simulate video list items with fading opacity
const VideoListItem = ({
  index,
  isLandscape,
}: {
  index: number;
  isLandscape: boolean;
}) => {
  const opacity = Math.max(0.2, 1 - index * 0.13);
  const height = isLandscape ? 44 : 48;

  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        opacity,
        transition: "opacity 0.2s",
      }}
    >
      {/* Thumbnail box */}
      <div
        style={{
          width: height,
          height: height,
          backgroundColor: "#27272a",
          borderRadius: "6px",
          flexShrink: 0,
        }}
      />
      {/* Text placeholders */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flex: 1,
        }}
      >
        <div
          style={{
            width: "85%",
            height: isLandscape ? 12 : 14,
            backgroundColor: "#3f3f46",
            borderRadius: "4px",
          }}
        />
        <div
          style={{
            width: "60%",
            height: isLandscape ? 10 : 12,
            backgroundColor: "#27272a",
            borderRadius: "4px",
          }}
        />
      </div>
    </div>
  );
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fmt = (searchParams.get("format") ?? "landscape") as Format;
  const { width, height } = DIMS[fmt];
  const isLandscape = fmt === "landscape";

  const logoSrc = loadLogoBase64();

  const numberPx = isLandscape ? 96 : 108;
  const labelPx = isLandscape ? 20 : 24;
  const textPx = isLandscape ? 48 : 56;
  const smallTextPx = isLandscape ? 18 : 22;
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

      {/* Main content — landscape: row, vertical: column */}
      <div
        style={{
          display: "flex",
          flexDirection: isLandscape ? "row" : "column",
          flexGrow: 1,
          paddingLeft: pad,
          paddingRight: pad,
          paddingBottom: isLandscape ? 40 : 60,
          gap: isLandscape ? "32px" : "24px",
        }}
      >
        {/* LEFT PANEL / TOP: Video list + number */}
        <div
          style={{
            flex: isLandscape ? 1 : "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            gap: "20px",
          }}
        >
          {/* Video list container */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: isLandscape ? "8px" : "10px",
              flex: 1,
            }}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <VideoListItem key={i} index={i} isLandscape={isLandscape} />
            ))}
          </div>

          {/* Big number + label */}
          <div
            style={{
              display: "flex",
              flexDirection: isLandscape ? "row" : "column",
              alignItems: isLandscape ? "baseline" : "flex-start",
              gap: isLandscape ? "12px" : "6px",
              marginTop: isLandscape ? 0 : "12px",
            }}
          >
            <div
              style={{
                fontSize: numberPx,
                fontWeight: 900,
                color: "#dc2626",
                letterSpacing: "-3px",
                lineHeight: 1,
              }}
            >
              247
            </div>
            <span
              style={{
                fontSize: labelPx,
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              videos to watch
            </span>
          </div>
        </div>

        {/* RIGHT PANEL / BOTTOM: Text copy */}
        <div
          style={{
            flex: isLandscape ? 1 : "auto",
            display: "flex",
            flexDirection: "column",
            justifyContent: isLandscape ? "center" : "flex-start",
            gap: "12px",
          }}
        >
          {/* Main headline */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                fontSize: textPx,
                fontWeight: 400,
                color: "#71717a",
                lineHeight: 1.2,
                letterSpacing: "-0.5px",
              }}
            >
              You'll never have
            </div>
            <div
              style={{
                fontSize: textPx,
                fontWeight: 900,
                color: "#ffffff",
                lineHeight: 1.2,
                letterSpacing: "-0.5px",
              }}
            >
              the time
            </div>
          </div>
          <div
            style={{
              fontSize: textPx,
              fontWeight: 900,
              color: "#ffffff",
              lineHeight: 1.2,
              letterSpacing: "-0.5px",
            }}
          >
            to watch it all.
          </div>

          {/* Subline */}
          <div
            style={{
              fontSize: smallTextPx,
              color: "#52525b",
              fontWeight: 400,
              marginTop: "8px",
              lineHeight: 1.3,
            }}
          >
            BriefTube turns every video into 4 min of audio.
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            paddingTop: "12px",
            paddingBottom: "12px",
            paddingLeft: "20px",
            paddingRight: "20px",
            background: "#dc2626",
            borderRadius: "8px",
            fontSize: isLandscape ? 18 : 20,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.3px",
          }}
        >
          Free · {SiteConfig.domain}
        </div>
      </div>
    </div>,
    { width, height },
  );
}
