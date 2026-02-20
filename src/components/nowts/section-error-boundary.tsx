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

class SectionErrorBoundaryInner extends Component<Props, State> {
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

    return this.props.children;
  }
}

/**
 * Error boundary wrapped in Suspense (React 19 + RSC pattern).
 * Suspense must be outside the Error Boundary to handle thenables
 * from RSC streaming before they reach the class component.
 */
export function SectionErrorBoundary({ children }: Props) {
  return (
    <Suspense fallback={null}>
      <SectionErrorBoundaryInner>{children}</SectionErrorBoundaryInner>
    </Suspense>
  );
}
