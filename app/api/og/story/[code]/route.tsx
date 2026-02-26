import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const referralUrl = `${SiteConfig.domain}/r/${code}`;

  // Generate QR code as data URL (white on dark)
  const qrDataUrl = await QRCode.toDataURL(referralUrl, {
    margin: 2,
    width: 320,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  // Read real logo from filesystem
  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallbackPath = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallbackPath);
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

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
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background orbs */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.12)",
          filter: "blur(200px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "15%",
          right: "0%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.08)",
          filter: "blur(180px)",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
          zIndex: 1,
          textAlign: "center",
          gap: "0px",
        }}
      >
        {/* Real logo */}
        <img
          src={logoBase64}
          width={120}
          height={120}
          style={{ marginBottom: "40px", borderRadius: "24px" }}
        />

        {/* Brand name */}
        <div
          style={{
            fontSize: "56px",
            fontWeight: "800",
            color: "#ffffff",
            letterSpacing: "-1px",
            marginBottom: "28px",
          }}
        >
          BriefTube
        </div>

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid rgba(239, 68, 68, 0.4)",
            background: "rgba(239, 68, 68, 0.12)",
            borderRadius: "100px",
            padding: "10px 28px",
            marginBottom: "56px",
          }}
        >
          <span
            style={{
              fontSize: "28px",
              fontWeight: "700",
              color: "#f87171",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            {SiteConfig.trialDays}-day free Pro trial
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: "800",
            color: "#ffffff",
            lineHeight: 1.05,
            letterSpacing: "-2px",
            marginBottom: "32px",
            maxWidth: "900px",
          }}
        >
          YouTube, summarized as audio
        </div>

        {/* Subheadline */}
        <div
          style={{
            fontSize: "36px",
            color: "#a1a1aa",
            lineHeight: 1.4,
            maxWidth: "820px",
            marginBottom: "72px",
          }}
        >
          AI summaries of your favorite channels delivered to Telegram —
          automatically.
        </div>

        {/* QR code */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              color: "#71717a",
              fontWeight: "500",
            }}
          >
            Scan to start your free trial
          </div>
          <div
            style={{
              background: "#ffffff",
              borderRadius: "20px",
              padding: "20px",
              display: "flex",
            }}
          >
            <img src={qrDataUrl} width={280} height={280} />
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1920,
    },
  );
}
