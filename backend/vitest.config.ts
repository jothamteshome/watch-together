import { defineConfig } from "vitest/config";

// https://vitest.dev/config/
export default defineConfig({
  test: {
    env: { LOG_LEVEL: "silent" },
    coverage: {
      include: ["src/**"],
      reporter: ["html", "text-summary"],
      // The levels reached after the feature merge; raise them as coverage grows
      thresholds: { statements: 92, branches: 86, functions: 95, lines: 94 },
    },
  },
});
