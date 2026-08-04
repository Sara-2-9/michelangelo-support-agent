/**
 * Phase 5.2 — Vite config: React SPA (web/) + Cloudflare Worker in ONE
 * dev server and ONE deploy.
 *
 * - `root: "web"` → the client code (index.html, React app) lives in web/
 * - `@cloudflare/vite-plugin` → runs src/worker.ts inside workerd during
 *   `vite dev` (identical to production), and bundles it on `vite build`
 * - `@tailwindcss/vite` → Tailwind CSS v4 (config lives in web/src/index.css)
 * - alias `@/` → web/src/ (same convention as our other frontend projects)
 *
 * Request routing (dev and prod behave the same):
 *   /api/*     → the Worker (src/worker.ts)
 *   everything → static assets built from web/ (the React SPA)
 */

import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

// The plugin looks for wrangler.toml in the Vite root (web/) — ours lives
// at the repo root next to src/, so we point at it explicitly.
const wranglerConfigPath = fileURLToPath(new URL("./wrangler.toml", import.meta.url));

export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss(), cloudflare({ configPath: wranglerConfigPath })],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./web/src", import.meta.url)) },
  },
});
