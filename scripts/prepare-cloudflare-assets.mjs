import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const buildDirectory = path.join(projectRoot, "build");
const cloudflareDirectory = path.join(projectRoot, "cloudflare-build");
const excludedFiles = new Set(["_redirects", ".assetsignore"]);

await rm(cloudflareDirectory, { recursive: true, force: true });
await cp(buildDirectory, cloudflareDirectory, {
    recursive: true,
    filter: source => !excludedFiles.has(path.basename(source))
});

console.log("已產生 Cloudflare 靜態資產。");
