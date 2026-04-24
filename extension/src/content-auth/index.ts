/**
 * Content script that runs on the `/extension/auth` bridge page.
 *
 * The page renders a one-time handoff code into a hidden DOM node. We read
 * the code, relay it to the background service worker, which POSTs it to
 * `/api/extension/auth/exchange` to receive the actual Supabase session.
 *
 * We deliberately never touch the tokens themselves from this content script
 * (historically they lived on the DOM directly — see commit ). Doing the
 * exchange server-side means any other extension with host_permissions on
 * brief-tube.com only sees the code, and the server invalidates it after a
 * single exchange (or 2 minutes, whichever comes first).
 */

const HANDOFF_NODE_ID = "brieftube-extension-handoff";

function readHandoffCode(): string | null {
  const node = document.getElementById(HANDOFF_NODE_ID);
  if (!node) return null;
  const code = node.dataset.handoffCode ?? "";
  return code.length > 0 ? code : null;
}

async function finish(code: string) {
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(
      { type: "AUTH_HANDOFF_CODE", payload: { code } },
      () => resolve(),
    );
  });
  // Let the user see the success state briefly, then close.
  setTimeout(() => window.close(), 600);
}

function poll() {
  const code = readHandoffCode();
  if (code) {
    void finish(code);
    return true;
  }
  return false;
}

if (!poll()) {
  const observer = new MutationObserver(() => {
    if (poll()) observer.disconnect();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-handoff-code"],
  });
  // Safety cutoff: the user may have closed the tab or hit the invalid-redirect
  // branch; stop observing after 5 min.
  setTimeout(() => observer.disconnect(), 5 * 60 * 1000);
}
