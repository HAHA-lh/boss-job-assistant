import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(await readFile(resolve(projectRoot, "package.json"), "utf8"));
const packageLock = JSON.parse(await readFile(resolve(projectRoot, "package-lock.json"), "utf8"));
const manifestSource = await readFile(resolve(projectRoot, "src/manifest.ts"), "utf8");
const manifestVersion = manifestSource.match(/\bversion:\s*"([0-9]+\.[0-9]+\.[0-9]+)"/)?.[1];

const versions = {
  "package.json": packageJson.version,
  "package-lock.json": packageLock.version,
  "package-lock root": packageLock.packages?.[""]?.version,
  "src/manifest.ts": manifestVersion
};

const unique = new Set(Object.values(versions));
if (unique.size !== 1 || unique.has(undefined)) {
  throw new Error(`Version mismatch:\n${JSON.stringify(versions, null, 2)}`);
}

console.log(`Version ${packageJson.version} is synchronized across package and manifest files.`);
