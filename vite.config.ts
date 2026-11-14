import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Minimalist light telemetry UI config — ensures Vite reloads Tailwind tokens cleanly.
export default defineConfig({
  plugins: [react()],
  css: {
    devSourcemap: false,
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 6000,
  },
});
