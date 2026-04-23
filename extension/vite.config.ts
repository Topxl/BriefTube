import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import devManifest from "./manifest.json" with { type: "json" };
import prodManifest from "./manifest.prod.json" with { type: "json" };

const isProd =
  process.env.BRIEFTUBE_PROD === "1" || process.env.NODE_ENV === "production";
const manifest = isProd ? prodManifest : devManifest;

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  define: {
    "import.meta.env.BRIEFTUBE_PROD": JSON.stringify(isProd ? "1" : "0"),
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        callback: "src/auth/callback.html",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: { port: 5173 },
  },
});
