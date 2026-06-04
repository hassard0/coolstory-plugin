#!/usr/bin/env node
import { access, chmod, mkdir, readFile, rm } from "node:fs/promises";
import { constants, existsSync, readdirSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = join(root, "desktop-packaged-smoke.json");
await rm(output, { force: true });

const appCommand = await locatePackagedApp();
const env = {
  ...process.env,
  COOLSTORY_PLUGIN_LIBRARY: "1",
  COOLSTORY_DESKTOP_SMOKE: "1",
  COOLSTORY_DESKTOP_SMOKE_OUT: output,
};

console.log(`Launching packaged desktop smoke: ${appCommand.command} ${appCommand.args.join(" ")}`.trim());
const child = spawn(appCommand.command, appCommand.args, {
  cwd: root,
  env,
  stdio: "inherit",
});

const timeout = setTimeout(() => {
  child.kill("SIGKILL");
}, 45_000);

const exitCode = await new Promise((resolveExit) => {
  child.on("exit", (code, signal) => resolveExit(signal ? 1 : code ?? 1));
  child.on("error", () => resolveExit(1));
});
clearTimeout(timeout);

let result;
try {
  result = JSON.parse(await readFile(output, "utf8"));
} catch (error) {
  throw new Error(`Packaged desktop smoke did not write ${output}: ${error.message}`);
}

console.log(JSON.stringify(result, null, 2));
if (exitCode !== 0 || result.ok !== true) {
  throw new Error(`Packaged desktop smoke failed with exit code ${exitCode}`);
}

async function locatePackagedApp() {
  const dist = join(root, "dist-electron");
  if (process.platform === "win32") {
    const exe = join(dist, "coolstory-desktop-win-x64.exe");
    await mustExist(exe);
    return { command: exe, args: [] };
  }

  if (process.platform === "darwin") {
    const appRoot = join(dist, "packaged-smoke-macos");
    const zip = join(dist, "coolstory-desktop-macos-arm64.zip");
    await mustExist(zip);
    await rm(appRoot, { recursive: true, force: true });
    await mkdir(appRoot, { recursive: true });
    const unzip = spawnSync("unzip", ["-q", zip, "-d", appRoot], { stdio: "inherit" });
    if (unzip.status !== 0) throw new Error(`Unable to unzip ${zip}`);
    const executable = findFirst(appRoot, (entry) => entry.endsWith(".app/Contents/MacOS/CoolStory Desktop"));
    if (!executable) throw new Error("Unable to locate macOS app executable");
    return { command: executable, args: [] };
  }

  const unpacked = join(dist, "linux-unpacked");
  const preferred = ["CoolStory Desktop", "coolstory-desktop", "coolstory-plugin"]
    .map((name) => join(unpacked, name))
    .find((entry) => existsSync(entry));
  const executable = preferred ?? findFirst(unpacked, (entry) => {
    const name = entry.split(/[\\/]/).pop();
    const parent = entry.slice(0, -name.length).replace(/[\\/]$/, "");
    if (parent !== unpacked) return false;
    if (["chrome-sandbox", "chrome_crashpad_handler"].includes(name)) return false;
    try {
      const stats = statSync(entry);
      return stats.isFile() && (stats.mode & constants.X_OK) !== 0;
    } catch {
      return false;
    }
  });
  if (!executable) throw new Error("Unable to locate linux-unpacked executable");
  await chmod(executable, 0o755);
  if (process.env.CI) {
    return { command: "xvfb-run", args: ["-a", executable, "--no-sandbox"] };
  }
  return { command: executable, args: ["--no-sandbox"] };
}

async function mustExist(path) {
  await access(path, constants.R_OK);
}

function findFirst(directory, predicate) {
  if (!existsSync(directory)) return null;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (predicate(fullPath)) return fullPath;
    if (entry.isDirectory()) {
      const found = findFirst(fullPath, predicate);
      if (found) return found;
    }
  }
  return null;
}
