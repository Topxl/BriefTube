import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Text,
} from "@react-email/components";

type Props = {
  videoTitle: string;
  dashboardUrl: string;
  trackingPixelUrl?: string;
};

export function FirstSummaryEmail({
  videoTitle,
  dashboardUrl,
  trackingPixelUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Your first BriefTube summary is ready — listen now</Preview>
      <Body
        style={{
          backgroundColor: "#0a0a0a",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          margin: "0",
          padding: "0",
        }}
      >
        <Container
          style={{
            maxWidth: "520px",
            margin: "40px auto",
            padding: "32px",
            backgroundColor: "#111111",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Heading
            style={{
              color: "#ffffff",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 8px",
            }}
          >
            Your first summary is ready
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 8px",
            }}
          >
            BriefTube just processed:
          </Text>
          <Text
            style={{
              color: "#ffffff",
              fontSize: "15px",
              fontWeight: "600",
              lineHeight: "1.5",
              margin: "0 0 20px",
              paddingLeft: "12px",
              borderLeft: "3px solid #dc2626",
            }}
          >
            {videoTitle}
          </Text>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 24px",
            }}
          >
            The audio summary has been delivered. You can read the transcript or
            replay it anytime from your dashboard.
          </Text>
          <Button
            href={dashboardUrl}
            style={{
              backgroundColor: "#dc2626",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: "600",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Open in dashboard
          </Button>
          <Hr
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              margin: "32px 0 24px",
            }}
          />
          <Text
            style={{
              color: "#71717a",
              fontSize: "12px",
              lineHeight: "1.5",
              margin: "0",
            }}
          >
            BriefTube · YouTube, summarized as audio
          </Text>
        </Container>
        {trackingPixelUrl && (
          <Img src={trackingPixelUrl} width={1} height={1} alt="" />
        )}
      </Body>
    </Html>
  );
}
