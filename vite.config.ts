import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./src/manifest";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    sourcemap: false,
    rollupOptions: {
      input: {
        sidepanel: "sidepanel.html"
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
    environmentOptions: {
      jsdom: {
        url: "https://www.zhipin.com/web/geek/job"
      }
    }
  }
});
