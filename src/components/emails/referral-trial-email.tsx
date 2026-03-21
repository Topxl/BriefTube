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
  daysLeft: number;
  referrerName: string;
  trackingPixelUrl?: string;
};

export function ReferralTrialEmail({
  daysLeft,
  referrerName,
  trackingPixelUrl,
}: Props) {
  const isLastDay = daysLeft <= 1;

  const previewText = isLastDay
    ? `${referrerName} is on BriefTube Pro. Your trial ends tomorrow`
    : `${referrerName} is on BriefTube Pro. Your trial ends in ${daysLeft} days`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
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
            {referrerName} is already on Pro
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 16px",
            }}
          >
            {referrerName} invited you to BriefTube and uses Pro every day.{" "}
            {isLastDay
              ? "Your trial ends tomorrow. Join them before you lose access."
              : `Your trial ends in ${daysLeft} days. Join them and keep getting AI-powered audio summaries in Discord, Slack or Telegram.`}
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
            · Unlimited YouTube channels
            <br />
            · Daily audio summaries in Discord, Slack or Telegram
            <br />
            · Multi-language TTS voices
            <br />· All future features
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
            Join {referrerName} on Pro
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
