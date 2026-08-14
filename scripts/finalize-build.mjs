import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");
const distDir = resolve(projectRoot, "dist");
const serviceWorkerPath = resolve(distDir, "service-worker.js");
const sidepanelScriptPath = resolve(distDir, "sidepanel.js");

// CRXJS intentionally emits a tiny module loader. Some Chrome installations
// report status code 3 while resolving that loader's generated dependency.
// Bundle the worker and its local storage helper into one classic script so
// registration has no secondary file to fetch.
await build({
  entryPoints: [resolve(projectRoot, "src/background.ts")],
  outfile: serviceWorkerPath,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome114",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  charset: "utf8"
});

const manifestPath = resolve(distDir, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.background = { service_worker: "service-worker.js" };
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

await rm(resolve(distDir, "service-worker-loader.js"), { force: true });

// Build the side panel as one classic script. This avoids a second module
// dependency graph during extension-page startup, while keeping PDF parsing
// lazy inside the existing dynamic import boundary.
await rm(resolve(distDir, "assets"), { recursive: true, force: true });
await build({
  entryPoints: [resolve(projectRoot, "src/sidepanel/main.tsx")],
  outfile: sidepanelScriptPath,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome114",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  charset: "utf8",
  define: {
    "process.env.NODE_ENV": '"production"'
  }
});

await writeFile(resolve(distDir, "sidepanel.html"), `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>求职匹配助手</title>
    <link rel="stylesheet" href="sidepanel.css" />
  </head>
  <body>
    <div id="root"><main class="loading-screen">正在启动求职匹配助手…</main></div>
    <script src="sidepanel.js"></script>
  </body>
</html>
`, "utf8");
