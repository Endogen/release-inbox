/// <reference types="vitest/config" />
import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // The libraries change less often than the app, so browsers keep them cached
            // across updates. Libraries only used by lazily loaded code stay with it.
            {
              name: "vendor",
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|@tanstack|radix-ui|@radix-ui)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    unstubGlobals: true,
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
})
