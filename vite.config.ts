import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || "/",
  server: {
    port: 3000,
    host: "0.0.0.0",
  },
  ssr: {
    external: ["pg"],
  },
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      router: {
        basepath:
          process.env.VITE_BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || undefined,
      },
    }),
    viteReact(),
  ],
});
