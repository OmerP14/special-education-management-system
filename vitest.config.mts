import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Date helpers mix local and UTC time, so pin the zone the app is used in —
// test workers inherit this from the parent process.
process.env.TZ = "Europe/Istanbul";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
