/**
 * Content script that runs on the `/extension/auth` bridge page.
 *
 * The page (a React Server Component on brief-tube.com) renders the user's
 * Supabase session into a hidden DOM node. This script reads it, hands it
 * back to the extension's background via chrome.runtime.sendMessage (internal,
 * so it works on localhost too — externally_connectable would not), and
 * closes the tab.
 *
 * Using the DOM as the handoff channel (vs. postMessage or a CustomEvent)
 * keeps the contract trivial for the page and avoids race conditions:
 * we simply wait for the node to appear.
 */

type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};

const HANDOFF_NODE_ID = "brieftube-extension-handoff";

function readHandoff(): SessionPayload | null {
  const node = document.getElementById(HANDOFF_NODE_ID);
  if (!node) return null;
  const accessToken = node.dataset.accessToken ?? "";
  const refreshToken = node.dataset.refreshToken ?? "";
  const expiresAt = Number(node.dataset.expiresAt ?? "0");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, expiresAt };
}

async function finish(payload: SessionPayload) {
  await new Promise<void>((resolve) => {
    chrome.runtime.sendMessage(
      { type: "AUTH_CALLBACK", payload },
      () => resolve(),
    );
  });
  // Let the user see the success state briefly, then close.
  setTimeout(() => window.close(), 600);
}

function poll() {
  const payload = readHandoff();
  if (payload) {
    void finish(payload);
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
    attributeFilter: ["data-access-token"],
  });
  // Safety cutoff: the user may have closed the tab or hit the invalid-redirect
  // branch; stop observing after 5 min.
  setTimeout(() => observer.disconnect(), 5 * 60 * 1000);
}
