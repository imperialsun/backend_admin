import { mergeConfig, defineConfig } from "vitest/config"

import baseConfig from "./vitest.config"

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      include: ["src/integration/**/*.integration.test.{ts,tsx}"],
      setupFiles: "./src/test/integration/setup.integration.ts",
      hookTimeout: 120_000,
      testTimeout: 120_000,
    },
  }),
)
