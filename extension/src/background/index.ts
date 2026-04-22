import {
  enqueue,
  fetchMe,
  fetchStatus,
  subscribeChannel,
  summarize,
} from "@/lib/api";
import { BRIEFTUBE_CONFIG } from "@/lib/config";
import { clearSession, getDeviceId, setSession } from "@/lib/storage";
import type { BgMessage } from "@/lib/types";

type AuthCallbackMessage = {
  type: "AUTH_CALLBACK";
  payload: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };
};

function openSignInFlow() {
  const extId = chrome.runtime.id;
  const url = `${BRIEFTUBE_CONFIG.authBase}/extension/auth?ext_id=${encodeURIComponent(extId)}`;
  chrome.tabs.create({ url });
}

chrome.runtime.onMessage.addListener(
  (
    message: BgMessage | AuthCallbackMessage,
    _sender,
    sendResponse,
  ) => {
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
          case "AUTH_CALLBACK": {
            await setSession({
              accessToken: message.payload.accessToken,
              refreshToken: message.payload.refreshToken,
              expiresAt: message.payload.expiresAt,
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
