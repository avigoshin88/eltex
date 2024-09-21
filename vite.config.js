import { defineConfig } from "vite";
import { resolve } from "path";

import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "VideoPlayer",
      fileName: "video-player",
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  plugins: [cssInjectedByJsPlugin()],
});
