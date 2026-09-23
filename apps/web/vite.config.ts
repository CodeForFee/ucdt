import path from "path";
import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // React Compiler ships only as a Babel plugin — see KLTN_dev-v2/frontend/vite.config.ts
    // for the parse-cost tradeoff this brings (measured there: 1.5s -> 22-35s build time).
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    modulePreload: { polyfill: false },
    rollupOptions: {
      output: {
        chunkFileNames(chunk) {
          const name = (chunk.name ?? "chunk").split("~")[0].slice(0, 40);
          return `assets/${name}-[hash].js`;
        },
        // Rolldown's chunking option (manualChunks/advancedChunks are deprecated in
        // rolldown 1.0 and ignored once codeSplitting is present). No catch-all
        // node_modules group on purpose: that would sweep every lazy route's
        // dependencies into the eager shell. entriesAware subdivides a group by
        // which entries actually use it, so a route only fetches what it needs.
        codeSplitting: {
          groups: [
            {
              name: "react",
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 100,
            },
            {
              name: "router-query",
              test: /node_modules[\\/](react-router|react-router-dom|@tanstack)[\\/]/,
              priority: 90,
            },
            // recharts pulls the whole d3 constellation; entriesAware keeps it off
            // routes that never draw a chart.
            {
              name: "recharts",
              test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|decimal\.js-light|internmap|delaunator|robust-predicates)[\\/]/,
              priority: 80,
              entriesAware: true,
            },
            // Only the map/simulation routes touch mapbox-gl (~200 kB); keep it off
            // dashboard/flood/air-quality/alerts.
            {
              name: "mapbox-gl",
              test: /node_modules[\\/]mapbox-gl[\\/]/,
              priority: 80,
              entriesAware: true,
            },
          ],
        },
      },
    },
  },
  server: {
    proxy: {
      // Both the legacy backend and the new gateway listen on 127.0.0.1:3001;
      // API_PROXY_TARGET points dev at another one (e.g. gateway on :3002 beside legacy).
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3001",
        changeOrigin: true,
        // /api/stream is a long-lived SSE connection (EventSource). http-proxy
        // already pipes the upstream response without buffering it in memory —
        // the only thing that would break it is a timeout closing the socket,
        // so both are disabled here.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
});
