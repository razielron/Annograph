import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// The viewer lives in ui/ and builds to dist/ui/, served by the codeviz server
// (or by `vite` in dev with /api proxied to a running `codeviz ui`).
export default defineConfig({
  root: fileURLToPath(new URL("./ui", import.meta.url)),
  base: "./",
  build: {
    outDir: fileURLToPath(new URL("./dist/ui", import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:7000",
    },
  },
});
