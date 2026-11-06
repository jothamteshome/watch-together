import { defineConfig } from "vitest/config";

// https://vitest.dev/config/
export default defineConfig({
  test: {
    coverage: {
      include: ["src/**"],
      reporter: ["html", "text-summary"],
    },
  },
});
