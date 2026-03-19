#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import { spawn } from "node:child_process";

import { getTarget, resolveCliArgs } from "../scripts/npm-platform.mjs";
import { installBinary, isSourceCheckout } from "../scripts/npm-install.mjs";

async function main() {
  if (isSourceCheckout()) {
    console.error("The published npm launcher is not installed in this source checkout. Use `bun run dev:app -- <file.md>` here.");
    process.exit(1);
  }

  const target = getTarget();
  let executablePath = target.installedPath;

  if (!fs.existsSync(executablePath)) {
    executablePath = await installBinary({ verbose: false });
  }

  if (!executablePath || !fs.existsSync(executablePath)) {
    throw new Error("Lenz is not installed. Re-run `npm install -g lenz` or `npm rebuild lenz`.");
  }

  const args = resolveCliArgs();
  const env = {
    ...process.env,
    OWD: process.cwd(),
  };

  const child =
    target.launchStrategy === "open-app"
      ? spawn("open", ["-n", executablePath, "--args", ...args], {
          cwd: process.cwd(),
          env,
          stdio: "inherit",
        })
      : spawn(executablePath, args, {
          cwd: process.cwd(),
          env,
          stdio: "inherit",
        });

  child.on("error", (error) => {
    console.error(`Failed to launch lenz: ${error.message}`);
    process.exit(1);
  });

  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
