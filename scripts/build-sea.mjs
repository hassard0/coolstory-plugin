import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { execFileSync } from "node:child_process";

const dist = "dist";
mkdirSync(dist, { recursive: true });

const ext = process.platform === "win32" ? ".exe" : "";
const defaultName = process.platform === "win32" ? "coolstory-desktop.exe" : "coolstory-desktop";
const binaryName = process.env.COOLSTORY_BINARY_NAME || defaultName;
const blobPath = join(dist, "coolstory-plugin.blob");
const seaConfigPath = join(dist, "sea-config.json");
const binaryPath = join(dist, binaryName);

writeFileSync(seaConfigPath, JSON.stringify({
  main: join(dist, "sea-entry.cjs"),
  output: blobPath,
  disableExperimentalSEAWarning: true,
}, null, 2));

execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], { stdio: "inherit" });
copyFileSync(process.execPath, binaryPath);

if (process.platform === "darwin") {
  execFileSync("codesign", ["--remove-signature", binaryPath], { stdio: "inherit" });
}

execFileSync(process.execPath, [
  join("node_modules", "postject", "dist", "cli.js"),
  binaryPath,
  "NODE_SEA_BLOB",
  blobPath,
  "--sentinel-fuse",
  "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
], { stdio: "inherit" });

if (process.platform === "darwin") {
  execFileSync("codesign", ["--sign", "-", binaryPath], { stdio: "inherit" });
}

if (process.platform === "win32") {
  setWindowsSubsystem(binaryPath, 2);
}

console.log(`Built ${basename(binaryPath)}`);

function setWindowsSubsystem(path, subsystem) {
  const binary = readFileSync(path);
  const peOffset = binary.readUInt32LE(0x3c);
  const signature = binary.toString("ascii", peOffset, peOffset + 4);
  if (signature !== "PE\u0000\u0000") {
    throw new Error(`Invalid PE signature in ${path}`);
  }
  const optionalHeaderOffset = peOffset + 24;
  const subsystemOffset = optionalHeaderOffset + 68;
  binary.writeUInt16LE(subsystem, subsystemOffset);
  writeFileSync(path, binary);
}
