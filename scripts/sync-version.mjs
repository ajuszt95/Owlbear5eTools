#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg.version;

console.log(`Syncing version ${version} from package.json...`);

// public/manifest.json
const manifestPath = path.join(root, "public/manifest.json");
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.version !== version) {
    manifest.version = version;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n");
    console.log(` - updated ${path.relative(root, manifestPath)}`);
  } else {
    console.log(` - ${path.relative(root, manifestPath)} already ${version}`);
  }
}

// docs/overview.md
const overviewPath = path.join(root, "docs/overview.md");
if (fs.existsSync(overviewPath)) {
  let content = fs.readFileSync(overviewPath, "utf8");
  const next = content.replace(/\| Current version \| .* \|/, `| Current version | ${version} |`);
  if (next !== content) {
    fs.writeFileSync(overviewPath, next);
    console.log(` - updated ${path.relative(root, overviewPath)}`);
  } else {
    console.log(` - ${path.relative(root, overviewPath)} already ${version}`);
  }
}

console.log("Done. Runtime files (HelpPopover/ViewPopover/etc) read version directly from package.json via src/version.ts — no manual edit needed.");
