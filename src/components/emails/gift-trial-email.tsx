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

type Props = {
  months: number;
  trialEndsAt: string; // formatted date string
};

export function GiftTrialEmail({ months, trialEndsAt }: Props) {
  const label = months === 1 ? "1 mois" : `${months} mois`;

  return (
    <Html>
      <Head />
      <Preview>{`Bonne nouvelle : ${label} d'accès Pro BriefTube offerts`}</Preview>
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
            Bonne nouvelle !
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 16px",
            }}
          >
            Nous vous offrons{" "}
            <strong style={{ color: "#ffffff" }}>
              {label} d&apos;accès Pro BriefTube
            </strong>{" "}
            sans frais, sans engagement.
          </Text>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 24px",
            }}
          >
            Votre accès est actif jusqu&apos;au{" "}
            <strong style={{ color: "#ffffff" }}>{trialEndsAt}</strong>.
            Profitez de toutes les fonctionnalités Pro : chaînes illimitées,
            résumés en audio, livraison Telegram automatique.
          </Text>
          <Button
            href="https://www.brief-tube.com/dashboard"
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
            Accéder à mon compte
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
