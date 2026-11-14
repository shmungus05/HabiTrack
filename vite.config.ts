import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimalist light telemetry UI config — pure TypeScript SPA.
export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 6000,
  },
});
