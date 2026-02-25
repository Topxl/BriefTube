"use client";

import { Toaster } from "@/components/ui/sonner";
import { DialogManagerRenderer } from "@/features/dialog-manager/dialog-manager-renderer";
import { GlobalDialogLazy } from "@/features/global-dialog/global-dialog-lazy";
import { PostHogPageView } from "@/components/posthog/posthog-page-view";
import { PostHogIdentify } from "@/components/posthog/posthog-identify";
import {
  isServer,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Suspense, type PropsWithChildren } from "react";

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

  return (
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
        <PostHogIdentify />
        <Toaster />
        <DialogManagerRenderer />
        <GlobalDialogLazy />
        {children}
      </QueryClientProvider>
    </ThemeProvider>
  );
};
