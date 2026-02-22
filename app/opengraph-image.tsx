import { ImageResponse } from "next/og";
import { SiteConfig } from "@/site-config";

export const runtime = "edge";
export const alt = SiteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#09090b",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "80px",
        fontFamily: "sans-serif",
      }}
    >
      {/* Brand accent line */}
      <div
        style={{
          width: "64px",
          height: "6px",
          background: SiteConfig.brand.primary,
          borderRadius: "3px",
          marginBottom: "40px",
        }}
      />

      {/* Title */}
      <div
        style={{
          fontSize: "80px",
          fontWeight: "800",
          color: "#ffffff",
          lineHeight: 1.1,
          letterSpacing: "-2px",
          marginBottom: "24px",
        }}
      >
        {SiteConfig.title}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: "32px",
          color: "#a1a1aa",
          fontWeight: "400",
          maxWidth: "700px",
          lineHeight: 1.4,
        }}
      >
        {SiteConfig.description}
      </div>

      {/* Domain badge */}
      <div
        style={{
          position: "absolute",
          bottom: "60px",
          right: "80px",
          fontSize: "20px",
          color: "#52525b",
          fontWeight: "500",
        }}
      >
        {SiteConfig.domain}
      </div>
    </div>,
    { ...size },
  );
}
