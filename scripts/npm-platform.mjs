import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPOSITORY = "thinkter/lenz";
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const VENDOR_DIR = path.join(PACKAGE_ROOT, "vendor");

const TARGETS = {
  "darwin:arm64": {
    assetFileName: (version) => `lenz-v${version}-macos-arm64.app.tar.gz`,
    installedPath: path.join(VENDOR_DIR, "lenz.app"),
    launchStrategy: "open-app",
  },
  "darwin:x64": {
    assetFileName: (version) => `lenz-v${version}-macos-x64.app.tar.gz`,
    installedPath: path.join(VENDOR_DIR, "lenz.app"),
    launchStrategy: "open-app",
  },
  "linux:x64": {
    assetFileName: (version) => `lenz-v${version}-linux-x64.AppImage`,
    installedPath: path.join(VENDOR_DIR, "lenz.AppImage"),
    launchStrategy: "direct",
  },
  "win32:x64": {
    assetFileName: (version) => `lenz-v${version}-windows-x64.exe`,
    installedPath: path.join(VENDOR_DIR, "lenz.exe"),
    launchStrategy: "direct",
  },
};

export function getTarget(platform = process.platform, arch = process.arch) {
  const target = TARGETS[`${platform}:${arch}`];
  if (!target) {
    throw new Error(
      `Unsupported platform ${platform}/${arch}. Supported targets: macOS arm64/x64, Linux x64, Windows x64.`,
    );
  }

  return target;
}

export function releaseTag(version) {
  return `v${version}`;
}

export function releaseAssetUrl(version, platform = process.platform, arch = process.arch) {
  const target = getTarget(platform, arch);
  return `https://github.com/${REPOSITORY}/releases/download/${releaseTag(version)}/${target.assetFileName(version)}`;
}

export function resolveCliArgs(argv = process.argv.slice(2)) {
  const args = [...argv];
  const fileArgIndex = args.findIndex((arg) => !arg.startsWith("--"));

  if (fileArgIndex >= 0) {
    args[fileArgIndex] = path.resolve(process.cwd(), args[fileArgIndex]);
  }

  return args;
}

