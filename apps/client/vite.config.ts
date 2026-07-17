import { fileURLToPath } from "node:url";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import babel from "vite-plugin-babel";
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
    // React Compiler - auto-memoizes components/hooks so useCallback/useMemo/React.memo
    // are no longer needed to avoid unnecessary re-renders (see docs/data-model.md's
    // "React Compiler" section). `@vitejs/plugin-react`'s own `babel` option only covers
    // JSX/fast-refresh transforms, not arbitrary Babel plugins, so this repo's plain
    // (non-Rolldown) Vite needs a separate `vite-plugin-babel` pass - `@rolldown/plugin-babel`
    // (the newer option react.dev now documents for `@vitejs/plugin-react` 6+) requires the
    // `rolldown` bundler itself as a peer dependency, which this repo doesn't use.
    // `include` (not the deprecated `filter`) - `vite-plugin-babel`'s own default `include`
    // (`/\.jsx?$/`) doesn't match `.tsx`/`.ts` at all, which would have silently skipped
    // every component in this app if left on its default.
    babel({
      include: /\.[jt]sx?$/,
      babelConfig: {
        presets: ["@babel/preset-typescript"],
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    // Required for PowerSync's WASM SQLite engine (@powersync/web) - see the powersync
    // skill's references/sdks/powersync-js-react.md "Vite Setup".
    wasm(),
    topLevelAwait(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      workbox: {
        // PowerSync's WASM SQLite engine ships multi-megabyte .wasm assets (the async
        // build is ~2.5 MB) - well past workbox's default 2 MiB precache limit, which
        // fails the build outright rather than just warning. This app is local-first by
        // design, so precaching the engine (not just app-shell JS/CSS) is the point, not
        // an accident to exclude.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
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
    // vite-plugin-top-level-await's injected helper uses top-level await itself, an
    // ES2022 feature - Vite's default `build.target` (a browser baseline that predates
    // ES2022) makes esbuild try and fail to downlevel it ("Transforming destructuring to
    // the configured target environment ... is not supported yet"). This app already
    // requires WASM SQLite/IndexedDB/Web Workers (PowerSync), so there's no realistic
    // older-browser target to support anyway.
    target: "esnext",
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
