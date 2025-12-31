import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    tsconfigPaths()
  ],
  build: {
    outDir: "../../src/basehook/static/",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://0.0.0.0:8000",
        changeOrigin: true,
      },
    },
  },
});
