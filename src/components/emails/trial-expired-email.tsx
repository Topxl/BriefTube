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

export function TrialExpiredEmail() {
  return (
    <Html>
      <Head />
      <Preview>Your BriefTube trial has ended</Preview>
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
            Your trial has ended
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 16px",
            }}
          >
            Your BriefTube trial is over. Your Telegram audio deliveries have
            been paused — but all your channels and settings are still saved.
          </Text>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 24px",
            }}
          >
            Upgrade to Pro to resume receiving daily AI-powered summaries of
            your YouTube channels, directly in Telegram.
          </Text>
          <Button
            href="https://www.brief-tube.com/dashboard/billing"
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
            Reactivate with Pro
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
      </Body>
    </Html>
  );
}
