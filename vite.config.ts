import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * WebLLM expects Hugging Face URL structure and automatically appends `/resolve/main/`
 * to model base paths. This middleware seamlessly routes those requests
 * to local static model assets without needing duplicated directories or symlinks.
 */
function webllmResolvePlugin(): Plugin {
  return {
    name: "webllm-resolve-middleware",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.includes("/resolve/main/")) {
          req.url = req.url.replace("/resolve/main/", "/");
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.includes("/resolve/main/")) {
          req.url = req.url.replace("/resolve/main/", "/");
        }
        next();
      });
    },
  };
}

// Minimalist light telemetry UI config — pure TypeScript SPA.
export default defineConfig({
  plugins: [react(), webllmResolvePlugin()],
  css: {
    devSourcemap: false,
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/ollama": {
        target: "http://127.0.0.1:11434",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ""),
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api/ollama": {
        target: "http://127.0.0.1:11434",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ollama/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 6000,
  },
});

