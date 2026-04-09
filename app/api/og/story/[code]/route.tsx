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

  const qrDataUrl = await QRCode.toDataURL(referralUrl, {
    margin: 1,
    width: 260,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const logoPath = path.join(process.cwd(), "public/logo-hd.png");
  const logoFallbackPath = path.join(process.cwd(), "public/logo-120.png");
  const logoBuffer = fs.existsSync(logoPath)
    ? fs.readFileSync(logoPath)
    : fs.readFileSync(logoFallbackPath);
  const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

  const trialDays = SiteConfig.referral.referredTrialDays;

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
          right: "-100px",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.18)",
          filter: "blur(220px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "200px",
          left: "-200px",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "rgba(220, 38, 38, 0.10)",
          filter: "blur(200px)",
        }}
      />

      {/* Red accent bar: top */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "6px",
          background: "#dc2626",
        }}
      />

      {/* Header: logo + brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
          padding: "72px 80px 0",
        }}
      >
        <img
          src={logoBase64}
          width={80}
          height={80}
          style={{ borderRadius: "18px" }}
        />
        <span
          style={{
            fontSize: "44px",
            fontWeight: "800",
            color: "#ffffff",
            letterSpacing: "-1px",
          }}
        >
          BriefTube
        </span>
      </div>

      {/* Main hero text */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "80px 80px 0",
          gap: "0px",
        }}
      >
        <div
          style={{
            fontSize: "108px",
            fontWeight: "900",
            color: "#ffffff",
            lineHeight: 0.95,
            letterSpacing: "-4px",
          }}
        >
          Stop
        </div>
        <div
          style={{
            fontSize: "108px",
            fontWeight: "900",
            color: "#ffffff",
            lineHeight: 0.95,
            letterSpacing: "-4px",
          }}
        >
          watching.
        </div>
        <div style={{ height: "20px" }} />
        <div
          style={{
            fontSize: "108px",
            fontWeight: "900",
            color: "#dc2626",
            lineHeight: 0.95,
            letterSpacing: "-4px",
          }}
        >
          Start
        </div>
        <div
          style={{
            fontSize: "108px",
            fontWeight: "900",
            color: "#dc2626",
            lineHeight: 0.95,
            letterSpacing: "-4px",
          }}
        >
          listening.
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          padding: "60px 80px 0",
          fontSize: "38px",
          color: "#71717a",
          lineHeight: 1.4,
          maxWidth: "900px",
        }}
      >
        AI audio summaries of your YouTube channels, delivered to Telegram
        automatically.
      </div>

      {/* Feature chips */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          padding: "60px 80px 0",
        }}
      >
        {[
          "Powered by Google Gemini AI",
          "Neural TTS voices, your language",
          "Telegram delivery, no app to open",
        ].map((feat) => (
          <div
            key={feat}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#dc2626",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "32px", color: "#a1a1aa" }}>{feat}</span>
          </div>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Bottom card: trial + QR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          margin: "0 80px 100px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "28px",
          padding: "40px 48px",
        }}
      >
        {/* Left: trial info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(220, 38, 38, 0.15)",
              border: "1px solid rgba(220, 38, 38, 0.3)",
              borderRadius: "100px",
              padding: "8px 24px",
              alignSelf: "flex-start",
            }}
          >
            <span
              style={{
                fontSize: "24px",
                fontWeight: "700",
                color: "#f87171",
                letterSpacing: "1px",
                textTransform: "uppercase",
              }}
            >
              {trialDays}-day free trial
            </span>
          </div>
          <div
            style={{ fontSize: "36px", fontWeight: "700", color: "#ffffff" }}
          >
            Scan to get started
          </div>
          <div style={{ fontSize: "26px", color: "#52525b" }}>
            {SiteConfig.domain}
          </div>
        </div>

        {/* Right: QR code */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: "20px",
            padding: "16px",
            display: "flex",
          }}
        >
          <img src={qrDataUrl} width={220} height={220} />
        </div>
      </div>
    </div>,
    {
      width: 1080,
      height: 1920,
    },
  );
}
