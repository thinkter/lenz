#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PACKAGE_ROOT, VENDOR_DIR, getTarget, releaseAssetUrl } from "./npm-platform.mjs";

const ENTRYPOINT = path.resolve(fileURLToPath(import.meta.url));

function isSourceCheckout() {
  return fs.existsSync(path.join(PACKAGE_ROOT, "src-tauri", "tauri.conf.json"));
}

function packageVersion() {
  const packageJsonPath = path.join(PACKAGE_ROOT, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  return packageJson.version;
}

async function downloadFile(url, destination) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "lenz-installer",
    },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const writeStream = fs.createWriteStream(destination);
  await pipeline(Readable.fromWeb(response.body), writeStream);
}

async function extractTarGz(archivePath, destinationDir) {
  const result = spawnSync("tar", ["-xzf", archivePath, "-C", destinationDir], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`tar extraction failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function installBinary({ force = false, verbose = true } = {}) {
  if (process.env.LENZ_SKIP_DOWNLOAD === "1") {
    if (verbose) {
      console.log("Skipping Lenz binary download because LENZ_SKIP_DOWNLOAD=1.");
    }
    return null;
  }

  if (isSourceCheckout()) {
    if (verbose) {
      console.log("Skipping Lenz binary download in the source checkout.");
    }
    return null;
  }

  const version = packageVersion();
  const target = getTarget();
  const destinationPath = target.installedPath;

  if (!force && fs.existsSync(destinationPath)) {
    return destinationPath;
  }

  await fsp.rm(VENDOR_DIR, { recursive: true, force: true });
  await fsp.mkdir(VENDOR_DIR, { recursive: true });

  const assetUrl = releaseAssetUrl(version);
  const tempPath = path.join(
    VENDOR_DIR,
    `${path.basename(destinationPath)}.download${path.extname(assetUrl) || ".tmp"}`,
  );

  if (verbose) {
    console.log(`Downloading ${assetUrl}`);
  }

  await downloadFile(assetUrl, tempPath);

  if (assetUrl.endsWith(".tar.gz")) {
    await extractTarGz(tempPath, VENDOR_DIR);
    await fsp.rm(tempPath, { force: true });
  } else {
    await fsp.rename(tempPath, destinationPath);
  }

  if (process.platform !== "win32" && fs.existsSync(destinationPath)) {
    await fsp.chmod(destinationPath, 0o755);
  }

  const metadataPath = path.join(VENDOR_DIR, "install.json");
  await fsp.writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        version,
        platform: process.platform,
        arch: process.arch,
        installedPath: destinationPath,
      },
      null,
      2,
    )}\n`,
  );

  return destinationPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === ENTRYPOINT) {
  installBinary().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

export { installBinary, isSourceCheckout, packageVersion };
