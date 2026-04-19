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
import { SiteConfig } from "@/site-config";

type Props = {
  dashboardUrl: string;
  trackingPixelUrl?: string;
};

export function ActivationEmail({ dashboardUrl, trackingPixelUrl }: Props) {
  return (
    <Html>
      <Head />
      <Preview>One step away from your first audio summary</Preview>
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
            You're one channel away from your first summary
          </Heading>
          <Text
            style={{
              color: "#a1a1aa",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 16px",
            }}
          >
            You created your BriefTube account but haven't added a YouTube
            channel yet. The service only kicks in once you follow at least one
            — then every new video is automatically summarized as audio.
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
            · Paste a channel URL or @handle
            <br />
            · Or import your YouTube subscriptions in one click
            <br />· First summary arrives within minutes
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
            Add your first channel
          </Button>
          <Text
            style={{
              color: "#71717a",
              fontSize: "13px",
              lineHeight: "1.5",
              margin: "16px 0 0",
            }}
          >
            {`Free for up to ${SiteConfig.freeChannelsLimit} channels. No credit card needed.`}
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
