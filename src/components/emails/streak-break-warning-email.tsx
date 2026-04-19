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
  dashboardUrl: string;
  streak: number;
  bestStreak: number;
  trackingPixelUrl?: string;
};

export function StreakBreakWarningEmail({
  dashboardUrl,
  streak,
  bestStreak,
  trackingPixelUrl,
}: Props) {
  const aboutToBeatRecord = streak >= bestStreak;
  const daysToRecord = Math.max(0, bestStreak - streak);

  return (
    <Html>
      <Head />
      <Preview>{`Your ${streak}-day streak ends at midnight`}</Preview>
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
          <Text
            style={{
              color: "#dc2626",
              fontSize: "12px",
              fontWeight: "700",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              margin: "0 0 8px",
            }}
          >
            Streak alert
          </Text>
          <Heading
            style={{
              color: "#ffffff",
              fontSize: "22px",
              fontWeight: "700",
              margin: "0 0 8px",
            }}
          >
            {`Your ${streak}-day streak is about to break`}
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 20px",
            }}
          >
            {aboutToBeatRecord
              ? `You're on your longest streak ever. One summary today keeps it alive.`
              : daysToRecord <= 3
                ? `You're ${daysToRecord} ${daysToRecord === 1 ? "day" : "days"} away from beating your personal record of ${bestStreak}. Don't lose it now.`
                : `You've engaged with BriefTube every day for ${streak} days. Listening to or reading one summary today keeps the streak alive.`}
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
            Keep my streak
          </Button>
          <Text
            style={{
              color: "#71717a",
              fontSize: "13px",
              lineHeight: "1.5",
              margin: "20px 0 0",
            }}
          >
            Takes less than 2 minutes. Play any summary or expand it to count.
          </Text>
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
