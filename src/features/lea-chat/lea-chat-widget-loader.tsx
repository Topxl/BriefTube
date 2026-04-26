"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const LeaChatWidget = dynamic(
  async () =>
    import("./lea-chat-widget").then((m) => ({ default: m.LeaChatWidget })),
  { ssr: false, loading: () => null },
);

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
};

/**
 * Mounts LeaChatWidget only after the browser is idle. The widget is hidden
 * on the public landing page and the auth pages, so on those routes its bundle
 * (~30-50 KB including ClientMarkdown + Sheet + Sonner deps) never has to
 * compete with the LCP critical path.
 */
export function LeaChatWidgetLoader() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const w = window as IdleWindow;
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return () => {
        if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
          (
            window as Window & {
              cancelIdleCallback: (handle: number) => void;
            }
          ).cancelIdleCallback(id);
        }
      };
    }
    const t = setTimeout(() => setReady(true), 2500);
    return () => clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <LeaChatWidget />;
}
