import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { env } from "../env";
import type { MailAdapter } from "./send-email";

const sesInstance =
  env.AWS_SES_ACCESS_KEY_ID && env.AWS_SES_SECRET_ACCESS_KEY
    ? new SESv2Client({
        credentials: {
          accessKeyId: env.AWS_SES_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SES_SECRET_ACCESS_KEY,
        },
        region: env.AWS_SES_REGION || "us-east-1",
      })
    : null;

export const sesMailAdapter: MailAdapter = {
  send: async (params) => {
    if (!sesInstance) {
      throw new Error(
        "AWS SES is not configured. Set AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY, and optionally AWS_SES_REGION.",
      );
    }

    try {
      const command = new SendEmailCommand({
        FromEmailAddress: params.from,
        Destination: {
          ToAddresses: Array.isArray(params.to) ? params.to : [params.to],
          ...(params.cc && {
            CcAddresses: Array.isArray(params.cc) ? params.cc : [params.cc],
          }),
          ...(params.bcc && {
            BccAddresses: Array.isArray(params.bcc) ? params.bcc : [params.bcc],
          }),
        },
        Content: {
          Simple: {
            Subject: {
              Data: params.subject,
              Charset: "UTF-8",
            },
            Body: {
              Html: {
                Data: params.html,
                Charset: "UTF-8",
              },
              ...(params.text && {
                Text: {
                  Data: params.text,
                  Charset: "UTF-8",
                },
              }),
            },
          },
        },
        ...(params.replyTo && {
          ReplyToAddresses: [params.replyTo],
        }),
        ...(params.headers && {
          DefaultEmailTags: Object.entries(params.headers).map(
            ([name, value]) => ({
              Name: name,
              Value: value,
            }),
          ),
        }),
      });

      const result = await sesInstance.send(command);

      if (!result.MessageId) {
        return {
          error: new Error("Failed to send email: No MessageId returned"),
          data: null,
        };
      }

      return { error: null, data: { id: result.MessageId } };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        error: new Error(`AWS SES error: ${errorMessage}`),
        data: null,
      };
    }
  },
};
