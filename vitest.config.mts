import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("./", import.meta.url)).replace(/\\/g, "/");

export default defineConfig({
  // Mirrors the "@/*" path alias in tsconfig.json.
  resolve: { alias: [{ find: /^@\//, replacement: root }] },
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
  },
});
