import { defineConfig } from "vite";
import { cpSync, existsSync } from "node:fs";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const src = fileURLToPath(new URL("../src", import.meta.url));

export default defineConfig({
  root,
  // Serve the app's public assets (app-icon.png, logos) so Shell samples match the app.
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react(), tailwind(), {
    name: "local-review-baseline",
    closeBundle() {
      const baseline = fileURLToPath(new URL("../.output/review-baseline/", import.meta.url));
      if (existsSync(baseline)) cpSync(baseline, fileURLToPath(new URL("../.output/component-gallery/baseline/", import.meta.url)), { recursive: true });
      // Plain redirect page (no JS entry) — keep bookmark URL working after merge into portal.
      cpSync(
        fileURLToPath(new URL("./scaffold-library.html", import.meta.url)),
        fileURLToPath(new URL("../.output/component-gallery/scaffold-library.html", import.meta.url)),
      );
    },
  }],
  resolve: {
    alias: {
      "@": src,
    },
  },
  build: {
    emptyOutDir: true,
    outDir: "../.output/component-gallery",
    rollupOptions: {
      input: {
        index: root + "index.html",
        preview: root + "preview.html",
        scaffold: root + "scaffold-library.html",
      },
    },
  },
});
