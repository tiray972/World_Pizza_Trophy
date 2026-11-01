import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Les tests partagent un seul émulateur Firestore : exécution séquentielle.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
