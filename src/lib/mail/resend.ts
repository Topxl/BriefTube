import { Resend } from "resend";
import { env } from "../env";
import type { MailAdapter } from "./send-email";

const resendInstance = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : null;

export const resend = resendInstance as Resend;

export const resendMailAdapter: MailAdapter = {
  send: async (params) => {
    if (!resendInstance) {
      throw new Error("Resend is not configured. Set RESEND_API_KEY.");
    }
    const { headers, ...rest } = params;
    const sendParams = headers ? { ...rest, headers } : rest;
    const result = await resendInstance.emails.send(sendParams);

    if (result.error) {
      return { error: new Error(result.error.message), data: null };
    }

    return { error: null, data: { id: result.data.id } };
  },
};
