import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __PRISM_VERSION__: '"test"', __PRISM_HOSTED_URL__: '""', __PRISM_TEST__: "true" },
  test: { include: ["extension/test/**/*.test.ts"], environment: "node" },
});
