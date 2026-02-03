// scripts/build.js
import { build } from "esbuild";
import { cpSync, rmSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = resolve(__dirname, "..");
const DIST = resolve(ROOT, "dist");

rmSync(DIST, { recursive: true, force: true });

// Copy static files
cpSync(resolve(ROOT, "public"), resolve(DIST, "public"), { recursive: true });
cpSync(resolve(ROOT, "manifest.json"), resolve(DIST, "manifest.json"));

await build({
  entryPoints: {
    "src/background/index": resolve(ROOT, "src/background/index.js"),
    "src/options/index": resolve(ROOT, "src/options/index.js"),
  },
  outdir: DIST,
  bundle: true,
  format: "esm",
  target: "chrome114",           // MV3 baseline
  sourcemap: true,
  logLevel: "info",
});
console.log("✅ Build complete → dist/");
