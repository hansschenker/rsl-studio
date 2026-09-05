#!/usr/bin/env node
/** Pass-through: merge optional .grok/app-env.json then run the given command. */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function readAppEnv(root) {
  try {
    const parsed = JSON.parse(readFileSync(join(root, ".grok/app-env.json"), "utf8"));
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([k, v]) => k.startsWith("VITE_") && typeof v === "string"),
    );
  } catch {
    return {};
  }
}

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error("usage: node scripts/with-app-env.mjs <command> [args…]");
  process.exit(2);
}
const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...readAppEnv(root), ...process.env },
});
child.on("exit", (code) => process.exit(code ?? 1));
