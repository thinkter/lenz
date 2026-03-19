#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];

if (!version) {
  console.error("Usage: node ./scripts/sync-version.mjs <version>");
  process.exit(1);
}

function updateJsonVersion(relativePath) {
  const filePath = path.join(packageRoot, relativePath);
  const json = JSON.parse(fs.readFileSync(filePath, "utf8"));
  json.version = version;
  fs.writeFileSync(filePath, `${JSON.stringify(json, null, 2)}\n`);
}

updateJsonVersion("package.json");
updateJsonVersion(path.join("src-tauri", "tauri.conf.json"));

const cargoTomlPath = path.join(packageRoot, "src-tauri", "Cargo.toml");
const cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
const nextCargoToml = cargoToml.replace(
  /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
  `$1${version}$3`,
);

if (cargoToml === nextCargoToml) {
  console.error("Failed to update version in src-tauri/Cargo.toml");
  process.exit(1);
}

fs.writeFileSync(cargoTomlPath, nextCargoToml);
