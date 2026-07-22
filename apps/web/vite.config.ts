import { resolve } from "node:path";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  // This repo keeps one root .env/.env.example, not one per app - see docker-compose.yml.
  envDir: resolve(__dirname, "../.."),
  plugins: [
    // Must come before react() - generates routeTree.gen.ts from src/routes.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  build: {
    rollupOptions: {
      // Second HTML entry point - the hidden iframe target for oidc-client-ts's silent
      // renew (recovers the in-memory session after a hard reload). Not a router route.
      input: {
        main: resolve(__dirname, "index.html"),
        "silent-renew": resolve(__dirname, "silent-renew.html"),
      },
    },
  },
});
