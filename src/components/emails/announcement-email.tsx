import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function AnnouncementEmail() {
  return (
    <Html>
      <Head />
      <Preview>New on BriefTube — Discord, Slack & RSS feed</Preview>
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
            What&apos;s new on BriefTube
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 16px",
            }}
          >
            We&apos;ve added three new ways to get your summaries:
          </Text>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "14px",
              lineHeight: "1.8",
              margin: "0 0 24px",
              paddingLeft: "16px",
            }}
          >
            · Discord delivery
            <br />
            · Slack delivery
            <br />· RSS podcast feed
          </Text>
          <Button
            href="https://www.brief-tube.com/dashboard/profile"
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
            Connect Discord or Slack
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
            <br />
            <a
              href="https://www.brief-tube.com/dashboard/profile"
              style={{
                color: "#71717a",
                textDecoration: "underline",
                fontSize: "12px",
              }}
            >
              Unsubscribe
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
