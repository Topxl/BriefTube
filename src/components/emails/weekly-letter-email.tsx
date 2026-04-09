import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  episodeNumber: number;
  title: string;
  preview: string;
  bodyHtml: string;
  unsubscribeUrl: string;
};

/**
 * Weekly narrative letter from Vin to the BriefTube community.
 * Designed to feel like a personal letter, not a marketing email:
 * serif body, minimal chrome, no buttons or CTAs in the main flow.
 */
export function WeeklyLetterEmail({
  episodeNumber,
  title,
  preview,
  bodyHtml,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#0a0a0a",
          fontFamily:
            'Georgia, "Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, serif',
          margin: "0",
          padding: "0",
          color: "#e4e4e7",
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            padding: "40px 32px",
            backgroundColor: "#0f0f10",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <Section>
            <Text
              style={{
                color: "#71717a",
                fontSize: "11px",
                fontWeight: "600",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                margin: "0 0 8px",
                fontFamily:
                  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              Episode {episodeNumber} · BriefTube
            </Text>
            <Heading
              style={{
                color: "#ffffff",
                fontSize: "26px",
                fontWeight: "700",
                lineHeight: "1.25",
                margin: "0 0 32px",
              }}
            >
              {title}
            </Heading>
          </Section>

          <Section
             
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
            style={{
              color: "#d4d4d8",
              fontSize: "16px",
              lineHeight: "1.75",
            }}
          />

          <Hr
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              margin: "40px 0 20px",
            }}
          />

          <Text
            style={{
              color: "#52525b",
              fontSize: "12px",
              lineHeight: "1.5",
              margin: "0 0 4px",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            Vous recevez cette lettre hebdomadaire car vous suivez
            l&apos;histoire de BriefTube.
          </Text>
          <Text
            style={{
              color: "#52525b",
              fontSize: "12px",
              lineHeight: "1.5",
              margin: "0",
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            <Link
              href={unsubscribeUrl}
              style={{ color: "#71717a", textDecoration: "underline" }}
            >
              Se désinscrire
            </Link>{" "}
            ·{" "}
            <Link
              href="https://www.brief-tube.com"
              style={{ color: "#71717a", textDecoration: "underline" }}
            >
              brief-tube.com
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
