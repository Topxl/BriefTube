import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock next/server `after()` which doesn't work outside request scope in tests
vi.mock("next/server", async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    after: (fn: () => unknown) => {
      void fn();
    },
  };
});
