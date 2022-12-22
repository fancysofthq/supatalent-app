import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import * as path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
    },
    // To allow importing `.d.ts` files.
    extensions: [
      ".mjs",
      ".js",
      ".ts",
      ".mts",
      ".jsx",
      ".tsx",
      ".json",
      ".d.ts",
    ],
    preserveSymlinks: true,
  },
  optimizeDeps: {
    include: ["bn.js", "js-sha3", "hash.js", "aes-js", "scrypt-js", "bech32"],
  },
  plugins: [vue()],
});
