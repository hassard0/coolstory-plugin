#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { Writable } from "node:stream";

const VERSION = "0.1.0";
const DEFAULT_API_URL = "https://coolstory.dev";
const CONFIG_PATH = join(homedir(), ".coolstory", "plugin.json");

const commands = {
  "--help": help,
  "-h": help,
  "--version": version,
  "-v": version,
  "auth": auth,
  "whoami": whoami,
  "status": status,
  "repos": repos,
  "prds": prds,
  "checkpoints": checkpoints,
  "checkpoint": checkpoint,
  "quickstart": quickstart,
};

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const handler = commands[command ?? "--help"];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  await handler(args);
  if (!command && process.platform === "win32" && process.stdin.isTTY && process.stdout.isTTY) {
    await waitForEnter();
  }
}

function help() {
  console.log(`CoolStory plugin ${VERSION}

Usage:
  coolstory-plugin auth login --token <token> [--api-url https://coolstory.dev]
  coolstory-plugin status
  coolstory-plugin whoami
  coolstory-plugin repos list
  coolstory-plugin repos refs <repo>
  coolstory-plugin repos archive <repo> [output.tar] [--ref main]
  coolstory-plugin prds list <repo>
  coolstory-plugin prds get <repo> <prd> [--json]
  coolstory-plugin checkpoints list <repo>
  coolstory-plugin checkpoint <title> --repo <repo> [--summary "..."] [--file path ...]
  coolstory-plugin quickstart

Environment:
  COOLSTORY_API_URL=https://coolstory.dev
  COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx`);
}

function version() {
  console.log(VERSION);
}

async function waitForEnter() {
  console.log("\nPress Enter to exit.");
  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));
}

async function auth(args) {
  const [subcommand, ...rest] = args;
  if (subcommand !== "login") {
    throw new Error("Usage: coolstory-plugin auth login --token <token> [--api-url <url>]");
  }
  const options = parseOptions(rest);
  if (!options.token) {
    throw new Error("--token is required");
  }
  const apiUrl = options["api-url"] ?? DEFAULT_API_URL;
  await writeConfig({ apiUrl, token: options.token });
  console.log(`Saved CoolStory credentials for ${apiUrl}`);
}

async function status() {
  const config = await loadConfig();
  console.log("CoolStory plugin");
  console.log(`API: ${config.apiUrl}`);
  console.log(`Token: ${config.token ? "configured" : "missing"}`);
  try {
    const health = await apiRequest(config, "/api/health", { auth: false });
    console.log(`Backend: ${health.status ?? "ok"}`);
  } catch (error) {
    console.log(`Backend: unavailable (${error.message})`);
  }
}

async function whoami() {
  const config = await requireAuth();
  const response = await apiRequest(config, "/api/public/cli/whoami");
  if (!response.user) {
    console.log("No CoolStory profile found for this token.");
    return;
  }
  console.log(`${response.user.display_name} (${response.user.primary_role})`);
  console.log(response.user.id);
}

async function repos(args) {
  const [subcommand, repo, output, ...rest] = args;
  const config = await requireAuth();
  if (subcommand === "list") {
    const response = await apiRequest(config, "/api/public/cli/repos");
    for (const item of response.repos ?? []) {
      console.log(`${item.slug} ${item.default_branch} ${item.name}`);
    }
    return;
  }
  if (subcommand === "refs") {
    requireValue(repo, "repo");
    const response = await apiRequest(config, `/api/public/git/repos/${encodeURIComponent(repo)}/refs`);
    for (const ref of response.refs ?? []) {
      const marker = ref.name === response.repo?.default_branch ? "*" : " ";
      console.log(`${marker} ${ref.name} ${ref.sha.slice(0, 12)} ${ref.archive_url}`);
    }
    return;
  }
  if (subcommand === "archive") {
    requireValue(repo, "repo");
    const options = parseOptions(rest);
    const ref = options.ref ?? "main";
    const path = `/api/public/git/repos/${encodeURIComponent(repo)}/archive?ref=${encodeURIComponent(ref)}`;
    const target = output && !output.startsWith("--") ? output : `${repo}-${ref.replace(/[^a-zA-Z0-9._-]+/g, "-")}.tar`;
    await download(config, path, target);
    console.log(`Wrote ${target}`);
    return;
  }
  throw new Error("Usage: coolstory-plugin repos <list|refs|archive>");
}

async function prds(args) {
  const [subcommand, repo, prd, ...rest] = args;
  const config = await requireAuth();
  if (subcommand === "list") {
    requireValue(repo, "repo");
    const response = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds`);
    for (const item of response.prds ?? []) {
      console.log(`${item.slug} ${item.status} ${item.branch_name} ${item.title}`);
    }
    return;
  }
  if (subcommand === "get") {
    requireValue(repo, "repo");
    requireValue(prd, "prd");
    const response = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds/${encodeURIComponent(prd)}`);
    if (rest.includes("--json")) {
      console.log(JSON.stringify(response, null, 2));
      return;
    }
    console.log(response.prd?.content ?? "");
    return;
  }
  throw new Error("Usage: coolstory-plugin prds <list|get>");
}

async function checkpoints(args) {
  const [subcommand, repo] = args;
  if (subcommand !== "list") {
    throw new Error("Usage: coolstory-plugin checkpoints list <repo>");
  }
  requireValue(repo, "repo");
  const config = await requireAuth();
  const response = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/checkpoints`);
  for (const item of response.checkpoints ?? []) {
    const sha = item.commit_sha ? ` ${item.commit_sha.slice(0, 12)}` : "";
    console.log(`${item.status} ${item.branch}${sha} ${item.title}`);
  }
}

async function checkpoint(args) {
  const titleParts = [];
  while (args.length > 0 && !args[0].startsWith("--")) {
    titleParts.push(args.shift());
  }
  const title = titleParts.join(" ");
  if (!title) {
    throw new Error("Checkpoint title is required");
  }
  const options = parseOptions(args);
  requireValue(options.repo, "--repo");
  const body = {
    branch: options.branch ?? process.env.COOLSTORY_BRANCH ?? "main",
    title,
    summary: options.summary,
    files: normalizeArray(options.file),
  };
  const config = await requireAuth();
  const response = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(options.repo)}/checkpoints`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  console.log(`Queued checkpoint ${response.checkpoint?.id ?? ""} for ${body.branch}`.trim());
}

function quickstart() {
  console.log(`CoolStory agent quickstart

1. Authenticate:
   coolstory-plugin auth login --token cs_pat_xxxxxxxxxxxxxxxx

2. Discover the project:
   coolstory-plugin repos list
   coolstory-plugin prds list <repo>
   coolstory-plugin prds get <repo> <prd>

3. Work from the PRD and cite files you changed.

4. Queue a checkpoint:
   coolstory-plugin checkpoint "Implemented PRD slice" --repo <repo> --file <path>

5. Open CoolStory to review branch history, comments, and PRs:
   https://coolstory.dev/app`);
}

async function requireAuth() {
  const config = await loadConfig();
  if (!config.token) {
    throw new Error("Missing token. Run `coolstory-plugin auth login --token <token>` or set COOLSTORY_TOKEN.");
  }
  return config;
}

async function loadConfig() {
  const env = {
    apiUrl: process.env.COOLSTORY_API_URL || undefined,
    token: process.env.COOLSTORY_TOKEN || undefined,
  };
  let fileConfig = {};
  try {
    fileConfig = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch {
    fileConfig = {};
  }
  return {
    apiUrl: env.apiUrl ?? fileConfig.apiUrl ?? DEFAULT_API_URL,
    token: env.token ?? fileConfig.token ?? "",
  };
}

async function writeConfig(config) {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

async function apiRequest(config, path, init = {}) {
  const response = await fetch(new URL(path, config.apiUrl), {
    method: init.method ?? "GET",
    body: init.body,
    headers: makeHeaders(config, init.auth !== false),
  });
  const body = await response.text();
  const data = body ? JSON.parse(body) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
  return data;
}

async function download(config, path, target) {
  const response = await fetch(new URL(path, config.apiUrl), {
    headers: makeHeaders(config, true),
  });
  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const stream = createWriteStream(target);
  await response.body.pipeTo(Writable.toWeb(stream));
}

function makeHeaders(config, auth) {
  const headers = new Headers({ Accept: "application/json" });
  if (auth && config.token) {
    headers.set("Authorization", `Bearer ${config.token}`);
  }
  if (auth) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const value = args[index + 1] && !args[index + 1].startsWith("--") ? args[++index] : true;
    if (options[name]) {
      options[name] = normalizeArray(options[name]).concat(value);
    } else {
      options[name] = value;
    }
  }
  return options;
}

function normalizeArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name} is required`);
  }
}

if (process.env.COOLSTORY_PLUGIN_LIBRARY !== "1") {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
