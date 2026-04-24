import {
  enqueue,
  exchangeHandoff,
  fetchMe,
  fetchStatus,
  subscribeChannel,
  summarize,
  updatePreferredLanguage,
} from "@/lib/api";
import { BRIEFTUBE_CONFIG } from "@/lib/config";
import { clearSession, getDeviceId, setSession } from "@/lib/storage";
import type { BgMessage } from "@/lib/types";

type AuthHandoffCodeMessage = {
  type: "AUTH_HANDOFF_CODE";
  payload: { code: string };
};

function openSignInFlow() {
  const extId = chrome.runtime.id;
  const url = `${BRIEFTUBE_CONFIG.authBase}/extension/auth?ext_id=${encodeURIComponent(extId)}`;
  chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener(
  (
    message: BgMessage | AuthHandoffCodeMessage,
    sender,
    sendResponse,
  ) => {
    // Ignore messages from any context other than our own extension
    // (content scripts, popup, other extension surfaces all share our id).
    if (sender.id && sender.id !== chrome.runtime.id) {
      sendResponse({ ok: false, error: "invalid_sender" });
      return false;
    }
    (async () => {
      try {
        switch (message.type) {
          case "ME": {
            const data = await fetchMe();
            sendResponse({ ok: true, data });
            return;
          }
          case "SUMMARIZE": {
            const data = await summarize(message.payload);
            sendResponse({ ok: true, data });
            return;
          }
          case "ENQUEUE": {
            const data = await enqueue(message.payload);
            sendResponse({ ok: true, data });
            return;
          }
          case "STATUS": {
            const data = await fetchStatus(
              message.payload.videoId,
              message.payload.language,
            );
            sendResponse({ ok: true, data });
            return;
          }
          case "SUBSCRIBE_CHANNEL": {
            const data = await subscribeChannel(message.payload);
            sendResponse({ ok: true, data });
            return;
          }
          case "SIGN_IN": {
            openSignInFlow();
            sendResponse({ ok: true });
            return;
          }
          case "SIGN_OUT": {
            await clearSession();
            sendResponse({ ok: true });
            return;
          }
          case "GET_DEVICE_ID": {
            const id = await getDeviceId();
            sendResponse({ ok: true, data: id });
            return;
          }
          case "UPDATE_LANGUAGE": {
            const data = await updatePreferredLanguage(
              message.payload.preferredLanguage,
            );
            sendResponse({ ok: true, data });
            return;
          }
          case "AUTH_HANDOFF_CODE": {
            const session = await exchangeHandoff(message.payload.code);
            await setSession({
              accessToken: session.accessToken,
              refreshToken: session.refreshToken,
              expiresAt: session.expiresAt,
            });
            sendResponse({ ok: true });
            return;
          }
          default:
            sendResponse({ ok: false, error: "unknown_message" });
        }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        sendResponse({ ok: false, error });
      }
    })();
    return true; // keep channel open for async response
  },
);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({
      url: `${BRIEFTUBE_CONFIG.authBase}/extension/welcome`,
    });
  }
});
