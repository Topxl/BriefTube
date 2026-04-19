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
  pricingUrl: string;
  trialEndsAt?: string | null;
  trackingPixelUrl?: string;
};

export function CheckoutAbandonedEmail({
  pricingUrl,
  trialEndsAt,
  trackingPixelUrl,
}: Props) {
  const trialDaysLeft =
    trialEndsAt && new Date(trialEndsAt) > new Date()
      ? Math.ceil(
          (new Date(trialEndsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

  return (
    <Html>
      <Head />
      <Preview>Need a hand finishing your upgrade?</Preview>
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
            Did you hit a snag?
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 16px",
            }}
          >
            You started upgrading to BriefTube Pro but didn't finish. Anything
            blocking you?
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
            · Card declined? Try another one.
            <br />
            · Price too high? Reply to this email and we'll figure something
            out.
            <br />· Not sure which plan? Monthly is $9 and cancels in one click.
          </Text>
          <Button
            href={pricingUrl}
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
            Finish upgrading
          </Button>
          {trialDaysLeft !== null && trialDaysLeft > 0 && (
            <Text
              style={{
                color: "#10b981",
                fontSize: "13px",
                lineHeight: "1.5",
                margin: "16px 0 0",
              }}
            >
              {`Your trial still has ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left.`}
            </Text>
          )}
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
