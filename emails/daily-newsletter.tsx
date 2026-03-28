import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type * as React from "react";

type Video = {
  videoId: string;
  title: string;
  youtubeUrl: string;
  summary: string;
  briefUrl: string;
};

type Props = {
  videos: Video[];
  date: string;
  unsubscribeUrl: string;
  language: string;
  fullSummary?: boolean;
};

export function DailyNewsletterEmail({
  videos,
  date,
  unsubscribeUrl,
  fullSummary = false,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>
        {`${videos.length} audio summar${videos.length > 1 ? "ies" : "y"} for ${date}`}
      </Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>BriefTube</Text>
            <Text style={headerDate}>{date}</Text>
          </Section>

          <Hr style={hr} />

          {/* Intro */}
          <Section style={section}>
            <Text style={intro}>
              Here are your{" "}
              <strong>
                {videos.length} audio summar{videos.length > 1 ? "ies" : "y"}
              </strong>{" "}
              for today.
            </Text>
          </Section>

          {/* Video list */}
          {videos.map((video, i) => (
            <Section key={video.videoId} style={videoCard}>
              {/* Thumbnail */}
              <Img
                src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
                alt={video.title}
                width="100%"
                height="auto"
                style={thumbnail}
              />
              <Text style={videoIndex}>#{i + 1}</Text>
              <Text style={videoTitle}>{video.title}</Text>
              <Text style={summaryText}>
                {fullSummary
                  ? video.summary
                  : video.summary.length > 400
                    ? `${video.summary.slice(0, 400)}…`
                    : video.summary}
              </Text>
              <div style={buttonRow}>
                <Button href={video.briefUrl} style={primaryButton}>
                  Listen to audio
                </Button>
                <Button
                  href={`https://www.brief-tube.com/videos/${video.videoId}`}
                  style={secondaryButton}
                >
                  Read full summary
                </Button>
                <Button href={video.youtubeUrl} style={tertiaryButton}>
                  YouTube
                </Button>
              </div>
              {i < videos.length - 1 && <Hr style={cardDivider} />}
            </Section>
          ))}

          <Hr style={hr} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You are receiving this email because you enabled the daily digest
              on{" "}
              <a href="https://brief-tube.com" style={link}>
                BriefTube
              </a>
              .
            </Text>
            <Text style={footerText}>
              <a href={unsubscribeUrl} style={unsubLink}>
                Unsubscribe
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyNewsletterEmail;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const body: React.CSSProperties = {
  backgroundColor: "#0f0f0f",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "24px 16px",
};

const header: React.CSSProperties = {
  textAlign: "center",
  paddingBottom: "8px",
};

const logoText: React.CSSProperties = {
  color: "#dc2626",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 4px",
  letterSpacing: "-0.5px",
};

const headerDate: React.CSSProperties = {
  color: "#6b7280",
  fontSize: "13px",
  margin: 0,
  textTransform: "capitalize",
};

const hr: React.CSSProperties = {
  borderColor: "#1f1f1f",
  margin: "16px 0",
};

const cardDivider: React.CSSProperties = {
  borderColor: "#1a1a1a",
  margin: "24px 0",
};

const section: React.CSSProperties = {
  padding: "0 4px",
};

const intro: React.CSSProperties = {
  color: "#e5e5e5",
  fontSize: "15px",
  margin: "0 0 8px",
};

const videoCard: React.CSSProperties = {
  backgroundColor: "#161616",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "4px",
};

const thumbnail: React.CSSProperties = {
  borderRadius: "8px",
  marginBottom: "12px",
  display: "block",
};

const videoIndex: React.CSSProperties = {
  color: "#dc2626",
  fontSize: "11px",
  fontWeight: "600",
  margin: "0 0 4px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const videoTitle: React.CSSProperties = {
  color: "#f5f5f5",
  fontSize: "16px",
  fontWeight: "600",
  margin: "0 0 10px",
  lineHeight: "1.4",
};

const summaryText: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 16px",
  whiteSpace: "pre-line",
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  backgroundColor: "#dc2626",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: "600",
  padding: "10px 18px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};

const secondaryButton: React.CSSProperties = {
  backgroundColor: "#262626",
  color: "#e5e5e5",
  fontSize: "13px",
  fontWeight: "500",
  padding: "10px 18px",
  borderRadius: "8px",
  textDecoration: "none",
  display: "inline-block",
};

const footer: React.CSSProperties = {
  textAlign: "center",
  padding: "0 4px",
};

const footerText: React.CSSProperties = {
  color: "#4b5563",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};

const link: React.CSSProperties = {
  color: "#6b7280",
  textDecoration: "underline",
};

const tertiaryButton: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  fontWeight: "500",
  padding: "10px 14px",
  textDecoration: "underline",
  display: "inline-block",
};

const unsubLink: React.CSSProperties = {
  color: "#4b5563",
  textDecoration: "underline",
};
