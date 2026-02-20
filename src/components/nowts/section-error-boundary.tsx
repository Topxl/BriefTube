"use client";

import { Component, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error boundary that wraps children in Suspense inside render().
 *
 * React 19 + RSC: children passed from a Server Component can be
 * thenables (lazy RSC references). Returning them directly from a
 * class component render() causes "uncached promise" errors.
 * Wrapping in Suspense inside render() ensures render() always
 * returns a synchronous React element — Suspense resolves the
 * thenables, errors still bubble up to this boundary.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("[SectionErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm font-medium">Something went wrong</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {this.state.error?.message}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-4"
            onClick={this.handleReset}
          >
            Try again
          </Button>
        </div>
      );
    }

    return <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}
