"use client";

import { Toaster } from "@/components/ui/sonner";
import { DialogManagerRenderer } from "@/features/dialog-manager/dialog-manager-renderer";
import { GlobalDialogLazy } from "@/features/global-dialog/global-dialog-lazy";
import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { ThemeProvider } from "next-themes";
import { PostHogProvider } from "posthog-js/react";
import { Suspense, type PropsWithChildren } from "react";
import { posthogClient, ensurePostHogInit } from "@/lib/posthog/client";

// Lazy-load PostHog to keep it out of the initial JS bundle (~176 KiB)
const PostHogPageView = dynamic(
  async () =>
    import("@/components/posthog/posthog-page-view").then((m) => ({
      default: m.PostHogPageView,
    })),
  { ssr: false },
);

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (isServer) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export const Providers = ({ children }: PropsWithChildren) => {
  const queryClient = getQueryClient();
  ensurePostHogInit();

  return (
    <PostHogProvider client={posthogClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        enableColorScheme
      >
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={null}>
            <PostHogPageView />
          </Suspense>
          <Toaster />
          <DialogManagerRenderer />
          <GlobalDialogLazy />
          {children}
        </QueryClientProvider>
      </ThemeProvider>
    </PostHogProvider>
  );
};
