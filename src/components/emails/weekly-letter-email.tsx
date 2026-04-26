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
  cliffhanger: string | null;
  dateLabel: string;
  unsubscribeUrl: string;
};

const BG = "#0a0a0a";
const CARD_BG = "#0f0f10";
const BORDER = "rgba(255,255,255,0.06)";
const TEXT = "#d4d4d8";
const TEXT_STRONG = "#fafafa";
const TEXT_MUTED = "#71717a";
const TEXT_DIM = "#52525b";
const ACCENT = "#818cf8"; // soft indigo, BriefTube vibe
const SERIF =
  'Georgia, "Iowan Old Style", "Palatino Linotype", "URW Palladio L", P052, serif';
const SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * Weekly narrative letter. Designed to feel like a personal editorial letter,
 * not a marketing email: serif body, generous line-height, no CTAs, a small
 * "Next time" teaser box for the cliffhanger, and a signed footer.
 */
export function WeeklyLetterEmail({
  episodeNumber,
  title,
  preview,
  bodyHtml,
  cliffhanger,
  dateLabel,
  unsubscribeUrl,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: BG,
          margin: 0,
          padding: 0,
          color: TEXT,
          fontFamily: SERIF,
        }}
      >
        {/* Outer wrapper with padding so the card doesn't touch edges on mobile */}
        <Section
          style={{
            backgroundColor: BG,
            padding: "32px 16px 48px",
          }}
        >
          <Container
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              backgroundColor: CARD_BG,
              border: `1px solid ${BORDER}`,
              borderRadius: "14px",
              overflow: "hidden",
            }}
          >
            {/* Masthead: brand line */}
            <Section
              style={{
                padding: "24px 40px 0",
                borderBottom: `1px solid ${BORDER}`,
              }}
            >
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                width="100%"
                style={{ marginBottom: "24px" }}
              >
                <tbody>
                  <tr>
                    <td>
                      <Text
                        style={{
                          color: TEXT_STRONG,
                          fontSize: "13px",
                          fontWeight: 700,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          margin: 0,
                          fontFamily: SANS,
                        }}
                      >
                        BriefTube
                      </Text>
                    </td>
                    <td align="right">
                      <Text
                        style={{
                          color: TEXT_MUTED,
                          fontSize: "11px",
                          fontWeight: 500,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          margin: 0,
                          fontFamily: SANS,
                        }}
                      >
                        {dateLabel}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Hero: episode badge + title */}
            <Section style={{ padding: "40px 40px 8px" }}>
              <Text
                style={{
                  color: ACCENT,
                  fontSize: "12px",
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  margin: "0 0 14px",
                  fontFamily: SANS,
                }}
              >
                Episode {episodeNumber}
              </Text>
              <Heading
                as="h1"
                style={{
                  color: TEXT_STRONG,
                  fontSize: "30px",
                  fontWeight: 700,
                  lineHeight: "1.22",
                  letterSpacing: "-0.01em",
                  margin: 0,
                  fontFamily: SERIF,
                }}
              >
                {title}
              </Heading>
            </Section>

            {/* Thin ornamental divider */}
            <Section style={{ padding: "28px 40px 0" }}>
              <table
                role="presentation"
                cellPadding={0}
                cellSpacing={0}
                width="100%"
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        borderTop: `1px solid ${BORDER}`,
                        width: "40px",
                      }}
                    />
                    <td style={{ width: "12px" }} />
                    <td
                      style={{
                        borderTop: `1px solid ${BORDER}`,
                      }}
                    />
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Body: the narrative itself */}
            <Section style={{ padding: "32px 40px 8px" }}>
              <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </Section>

            {/* Signature */}
            <Section style={{ padding: "16px 40px 0" }}>
              <Text
                style={{
                  color: TEXT_MUTED,
                  fontSize: "15px",
                  fontStyle: "italic",
                  margin: "0 0 4px",
                  fontFamily: SERIF,
                }}
              >
                Yours,
              </Text>
              <Text
                style={{
                  color: TEXT_STRONG,
                  fontSize: "18px",
                  fontWeight: 600,
                  margin: 0,
                  fontFamily: SERIF,
                }}
              >
                Vin
              </Text>
            </Section>

            {/* Cliffhanger box: "Next episode" teaser */}
            {cliffhanger && cliffhanger.trim().length > 0 && (
              <Section style={{ padding: "36px 40px 8px" }}>
                <table
                  role="presentation"
                  cellPadding={0}
                  cellSpacing={0}
                  width="100%"
                  style={{
                    borderLeft: `3px solid ${ACCENT}`,
                    backgroundColor: "rgba(129,140,248,0.06)",
                    borderRadius: "0 8px 8px 0",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "18px 22px" }}>
                        <Text
                          style={{
                            color: ACCENT,
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            margin: "0 0 8px",
                            fontFamily: SANS,
                          }}
                        >
                          Next time
                        </Text>
                        <Text
                          style={{
                            color: TEXT,
                            fontSize: "15px",
                            lineHeight: "1.6",
                            margin: 0,
                            fontStyle: "italic",
                            fontFamily: SERIF,
                          }}
                        >
                          {cliffhanger}
                        </Text>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>
            )}

            {/* Spacer before footer */}
            <Section style={{ padding: "40px 40px 0" }}>
              <Hr style={{ borderColor: BORDER, margin: 0 }} />
            </Section>

            {/* Footer */}
            <Section style={{ padding: "20px 40px 32px" }}>
              <Text
                style={{
                  color: TEXT_DIM,
                  fontSize: "12px",
                  lineHeight: "1.6",
                  margin: "0 0 4px",
                  fontFamily: SANS,
                }}
              >
                You&apos;re receiving this because you follow the BriefTube
                story. One letter, every Friday.
              </Text>
              <Text
                style={{
                  color: TEXT_DIM,
                  fontSize: "12px",
                  lineHeight: "1.6",
                  margin: 0,
                  fontFamily: SANS,
                }}
              >
                <Link
                  href="https://www.brief-tube.com"
                  style={{
                    color: TEXT_MUTED,
                    textDecoration: "underline",
                  }}
                >
                  brief-tube.com
                </Link>
                {" · "}
                <Link
                  href={unsubscribeUrl}
                  style={{
                    color: TEXT_MUTED,
                    textDecoration: "underline",
                  }}
                >
                  Unsubscribe
                </Link>
              </Text>
            </Section>
          </Container>

          {/* Breathing room below the card */}
          <Text
            style={{
              textAlign: "center",
              color: TEXT_DIM,
              fontSize: "11px",
              margin: "24px 0 0",
              fontFamily: SANS,
            }}
          >
            BriefTube · Episode {episodeNumber}
          </Text>
        </Section>
      </Body>
    </Html>
  );
}
