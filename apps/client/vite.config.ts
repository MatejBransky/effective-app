import { fileURLToPath } from "node:url";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  // This repo keeps one shared .env/.env.example at the repo root (see README's "cp
  // .env.example .env") rather than a separate apps/client/.env - point Vite at it
  // instead of duplicating the KEYCLOAK_*/POWERSYNC_* vars in a second file.
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  plugins: [
    // Must come before react() - generates routeTree.gen.ts from src/routes.
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    // Required for PowerSync's WASM SQLite engine (@powersync/web) - see the powersync
    // skill's references/sdks/powersync-js-react.md "Vite Setup".
    wasm(),
    topLevelAwait(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      manifest: {
        name: "Effective App",
        short_name: "Effective",
        description: "Local-first, multi-tenant, AI-agent-controllable app",
        theme_color: "#2563eb",
        icons: [
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  optimizeDeps: {
    exclude: ["@journeyapps/wa-sqlite", "@powersync/web"],
  },
  worker: {
    format: "es",
    plugins: () => [wasm(), topLevelAwait()],
  },
  build: {
    rollupOptions: {
      // silent-renew.html (src/lib/auth.ts's silent-renew iframe target) is a second
      // page, not a route under index.html's SPA - Vite only bundles index.html by
      // default, so it needs to be listed explicitly here to survive a production build.
      input: {
        main: fileURLToPath(new URL("index.html", import.meta.url)),
        silentRenew: fileURLToPath(new URL("silent-renew.html", import.meta.url)),
      },
    },
  },
});
