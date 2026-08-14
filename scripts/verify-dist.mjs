import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const distDir = resolve(projectRoot, "dist");
const manifest = JSON.parse(await readFile(resolve(distDir, "manifest.json"), "utf8"));

if (manifest.manifest_version !== 3) {
  throw new Error("dist/manifest.json is not Manifest V3");
}

const requiredFiles = [
  manifest.background?.service_worker,
  manifest.side_panel?.default_path,
  "sidepanel.js",
  "sidepanel.css"
].filter(Boolean);

for (const relativePath of requiredFiles) {
  await access(resolve(distDir, relativePath));
}

if (manifest.background?.service_worker !== "service-worker.js") {
  throw new Error("Production manifest must use the stable single-file service worker");
}

if (manifest.background?.type) {
  throw new Error("Production service worker must not depend on module loading");
}

const worker = await readFile(resolve(distDir, "service-worker.js"), "utf8");
if (/\bimport\s*(?:[({*]|["'])/.test(worker)) {
  throw new Error("Production service worker contains an import and is not self-contained");
}

// Parse the generated classic worker without executing Chrome APIs.
new Function(worker);

const sidepanelHtml = await readFile(resolve(distDir, "sidepanel.html"), "utf8");
if (/type=["']module["']/.test(sidepanelHtml)) {
  throw new Error("Production side panel must not depend on module-script startup");
}
if (!sidepanelHtml.includes('src="sidepanel.js"') || !sidepanelHtml.includes("正在启动求职匹配助手")) {
  throw new Error("Production side panel is missing its stable script or visible startup fallback");
}

const sidepanelScript = await readFile(resolve(distDir, "sidepanel.js"), "utf8");
new Function(sidepanelScript);

console.log(`Verified ${requiredFiles.length} entry files, a self-contained worker, and a classic side-panel bundle.`);
