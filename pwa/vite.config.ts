import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Unique per build/dev-start. Used as the persisted-query-cache buster so a
  // new build discards the old IndexedDB cache instead of serving stale data
  // when an API result shape changes.
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString()),
  },
  // Build output goes into the Worker's static-asset dir so wrangler deploy
  // serves the PWA alongside /api/* from the same origin.
  build: {
    outDir: fileURLToPath(new URL("../worker/dist/pwa", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
    target: "es2020",
  },
  server: {
    port: 5173,
    // Proxy /api/* to the local Worker dev server during PWA dev.
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
