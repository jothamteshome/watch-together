import { defineConfig } from "vitest/config";

// https://vitest.dev/config/
export default defineConfig({
  test: {
    coverage: {
      include: ["src/**"],
      reporter: ["html", "text-summary"],
      // The levels reached after the feature merge; raise them as coverage grows
      thresholds: { statements: 92, branches: 84, functions: 94, lines: 93 },
    },
  },
});
