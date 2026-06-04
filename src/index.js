#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";

const VERSION = "0.1.11";
const DEFAULT_API_URL = "https://coolstory.dev";
const CONFIG_PATH = join(homedir(), ".coolstory", "plugin.json");
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const commands = {
  "--help": help,
  "-h": help,
  "--version": version,
  "-v": version,
  "auth": auth,
  "whoami": whoami,
  "status": status,
  "repos": repos,
  "clone": clone,
  "artifacts": prds,
  "prds": prds,
  "checkpoints": checkpoints,
  "checkpoint": checkpoint,
  "context": context,
  "skills": skills,
  "skill": skills,
  "quickstart": quickstart,
  "gui": gui,
};

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const invokedAs = basename(process.argv[1] ?? "");
  const defaultCommand = invokedAs === "coolstory" ? "--help" : "gui";
  const handler = commands[command ?? defaultCommand];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  await handler(args);
}

function help() {
  console.log(`CoolStory CLI ${VERSION}

Usage:
  coolstory auth login --token <token> [--api-url https://coolstory.dev]
  coolstory status
  coolstory whoami
  coolstory repos list
  coolstory repos refs <repo>
  coolstory repos archive <repo> [output.tar] [--ref main]
  coolstory repos clone <repo> [dir] [--ref main]
  coolstory clone <repo> [dir] [--ref main]
  coolstory artifacts list <repo>
  coolstory artifacts get <repo> <artifact> [--json]
  coolstory artifacts pull <repo> <artifact> [file.md] [--force]
  coolstory artifacts kinds
  coolstory artifacts push <repo> <file.md> [--title "..."] [--kind prd] [--branch main] [--slug slug]
  coolstory artifacts create <repo> <file.md> [--title "..."] [--kind prd] [--branch main] [--slug slug]
  coolstory artifacts update <repo> <file.md> [--title "..."] [--kind prd] [--branch main] [--slug slug]
  coolstory prds list <repo>                         # legacy alias
  coolstory prds get <repo> <prd> [--json]            # legacy alias
  coolstory checkpoints list <repo>
  coolstory checkpoint <title> --repo <repo> [--summary "..."] [--file path ...]
  coolstory context <repo> [artifact-slug]
  coolstory skills
  coolstory quickstart

Desktop GUI:
  coolstory-desktop gui

Environment:
  COOLSTORY_API_URL=https://coolstory.dev
  COOLSTORY_TOKEN=cs_pat_xxxxxxxxxxxxxxxx`);
}

function version() {
  console.log(VERSION);
}

async function auth(args) {
  const [subcommand, ...rest] = args;
  if (subcommand !== "login") {
    throw new Error("Usage: coolstory auth login --token <token> [--api-url <url>]");
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
  console.log("CoolStory CLI");
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
    const archiveArgs = [output, ...rest].filter(Boolean);
    const { positional, optionArgs } = splitPositionalAndOptions(archiveArgs);
    const options = parseOptions(optionArgs);
    const ref = options.ref ?? "main";
    const path = `/api/public/git/repos/${encodeURIComponent(repo)}/archive?ref=${encodeURIComponent(ref)}`;
    const target = positional[0] ?? `${repo}-${ref.replace(/[^a-zA-Z0-9._-]+/g, "-")}.tar`;
    await download(config, path, target);
    console.log(`Wrote ${target}`);
    return;
  }
  if (subcommand === "clone") {
    requireValue(repo, "repo");
    await cloneRepo(config, repo, [output, ...rest].filter(Boolean));
    return;
  }
  throw new Error("Usage: coolstory repos <list|refs|archive|clone>");
}

async function clone(args) {
  const [repo, ...rest] = args;
  requireValue(repo, "repo");
  const config = await requireAuth();
  await cloneRepo(config, repo, rest);
}

async function prds(args) {
  const [subcommand, repo, prd, ...rest] = args;
  if (subcommand === "kinds") {
    for (const kind of artifactKinds()) console.log(kind);
    return;
  }
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
  if (subcommand === "pull") {
    requireValue(repo, "repo");
    requireValue(prd, "artifact");
    const { positional, optionArgs } = splitPositionalAndOptions(rest);
    const options = parseOptions(optionArgs);
    const target = positional[0] || `${prd}.md`;
    if (existsSync(target) && !options.force) {
      throw new Error(`${target} already exists. Pass --force to overwrite it.`);
    }
    const response = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds/${encodeURIComponent(prd)}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, response.prd?.content ?? "", "utf8");
    console.log(`Wrote ${target}`);
    return;
  }
  if (subcommand === "push" || subcommand === "create" || subcommand === "update") {
    requireValue(repo, "repo");
    requireValue(prd, "file");
    const options = parseOptions(rest);
    const content = await readFile(prd, "utf8");
    const title = options.title || inferMarkdownTitle(content, prd);
    const slug = options.slug || slugify(title);
    const kind = options.kind || inferArtifactKind(prd);
    const body = {
      title,
      slug,
      kind,
      branch_name: options.branch || process.env.COOLSTORY_BRANCH || "main",
      status: options.status || "draft",
      content,
    };
    const response = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (subcommand === "create" && response.created === false) {
      console.warn(`Artifact ${response.artifact?.slug} already existed; updated existing artifact.`);
    }
    if (subcommand === "update" && response.created === true) {
      console.warn(`Artifact ${response.artifact?.slug} did not exist; created new artifact.`);
    }
    const action = response.created ? "Created" : "Updated";
    console.log(`${action} artifact ${response.artifact?.slug} (${response.artifact?.kind}) on ${response.artifact?.branch_name}`);
    if (response.commit_sha) console.log(`Commit ${response.commit_sha}`);
    return;
  }
  throw new Error("Usage: coolstory artifacts <list|get|pull|kinds|push|create|update>");
}

async function checkpoints(args) {
  const [subcommand, repo] = args;
  if (subcommand !== "list") {
    throw new Error("Usage: coolstory checkpoints list <repo>");
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

async function context(args) {
  const [repo, artifact] = args;
  requireValue(repo, "repo");
  const config = await requireAuth();
  const [reposBody, artifactsBody, refsBody] = await Promise.all([
    apiRequest(config, "/api/public/cli/repos"),
    apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds`),
    apiRequest(config, `/api/public/git/repos/${encodeURIComponent(repo)}/refs`).catch((error) => ({ error: error.message, refs: [] })),
  ]);
  const repoRow = (reposBody.repos ?? []).find((item) => item.slug === repo);
  const body = {
    repo: repoRow ?? artifactsBody.repo ?? { slug: repo },
    refs: refsBody.refs ?? [],
    artifacts: artifactsBody.prds ?? [],
    artifact: null,
  };
  if (artifact) {
    const detail = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds/${encodeURIComponent(artifact)}`);
    body.artifact = detail.prd ?? null;
  }
  console.log(JSON.stringify(body, null, 2));
}

async function skills() {
  const path = join(PACKAGE_ROOT, "SKILLS.md");
  try {
    console.log(await readFile(path, "utf8"));
  } catch {
    console.log(defaultSkillsText());
  }
}

function quickstart() {
  console.log(`CoolStory agent quickstart

1. Authenticate:
   coolstory auth login --token cs_pat_xxxxxxxxxxxxxxxx

2. Discover the project:
   coolstory repos list
   coolstory context <repo>
   coolstory artifacts list <repo>
   coolstory artifacts get <repo> <artifact>

3. If you create or rewrite a Markdown artifact, push it:
   coolstory artifacts push <repo> <artifact-file.md> --kind prd --branch <branch>

4. Work from the artifact and cite files you changed.

5. Queue a checkpoint:
   coolstory checkpoint "Implemented artifact slice" --repo <repo> --file <path>

6. Open CoolStory to review branch history, comments, and PRs:
   https://coolstory.dev/app`);
}

async function gui() {
  if (process.platform === "win32" && process.env.COOLSTORY_DESKTOP_CHILD !== "1") {
    const child = spawn(process.execPath, ["gui"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, COOLSTORY_DESKTOP_CHILD: "1" },
    });
    child.unref();
    return;
  }

  const { url } = await startDesktopServer();
  console.log(`CoolStory desktop client is running at ${url}`);
  openAppWindow(url);
}

export async function startDesktopServer() {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      if (req.method === "GET" && url.pathname === "/") {
        send(res, 200, desktopHtml(), "text/html; charset=utf-8");
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/status") {
        const config = await loadConfig();
        let profile = null;
        let error = null;
        if (config.token) {
          try {
            profile = (await apiRequest(config, "/api/public/cli/whoami")).user ?? null;
          } catch (e) {
            error = e.message;
          }
        }
        sendJson(res, { ok: true, apiUrl: config.apiUrl, authenticated: Boolean(config.token && !error), profile, error });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/start") {
        const body = await readJson(req);
        const apiUrl = body.apiUrl || DEFAULT_API_URL;
        await writeConfig({ ...(await loadConfig()), apiUrl });
        const response = await fetch(new URL("/api/public/cli/auth/device/start", apiUrl), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ device_name: `CoolStory Desktop (${hostname()})` }),
        });
        const payload = await response.json();
        if (!response.ok) {
          sendJson(res, payload, response.status);
          return;
        }
        const opened = await openExternal(payload.verification_uri_complete);
        payload.browser_opened = opened;
        sendJson(res, payload);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/auth/poll") {
        const body = await readJson(req);
        const config = await loadConfig();
        const response = await fetch(new URL("/api/public/cli/auth/device/poll", config.apiUrl), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ device_code: body.device_code }),
        });
        const payload = await response.json();
        if (response.ok && payload.access_token) {
          await writeConfig({ ...config, token: payload.access_token });
        }
        sendJson(res, payload, response.status);
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/logout") {
        const config = await loadConfig();
        await writeConfig({ ...config, token: "" });
        sendJson(res, { ok: true });
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/repos") {
        const config = await requireAuth();
        sendJson(res, await apiRequest(config, "/api/public/cli/repos"));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/prds") {
        const repo = url.searchParams.get("repo");
        if (!repo) {
          sendJson(res, { error: "repo is required" }, 400);
          return;
        }
        const config = await requireAuth();
        sendJson(res, await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds`));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/prd") {
        const repo = url.searchParams.get("repo");
        const prd = url.searchParams.get("prd");
        if (!repo || !prd) {
          sendJson(res, { error: "repo and prd are required" }, 400);
          return;
        }
        const config = await requireAuth();
        sendJson(res, await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds/${encodeURIComponent(prd)}`));
        return;
      }
      if (url.pathname === "/api/collab") {
        const repo = url.searchParams.get("repo");
        const prd = url.searchParams.get("prd");
        if (!repo || !prd) {
          sendJson(res, { error: "repo and prd are required" }, 400);
          return;
        }
        const config = await requireAuth();
        if (req.method === "GET") {
          const after = url.searchParams.get("after_revision") ?? "0";
          sendJson(res, await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds/${encodeURIComponent(prd)}/collab?after_revision=${encodeURIComponent(after)}`));
          return;
        }
        if (req.method === "POST") {
          const body = await readJson(req);
          sendJson(res, await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/prds/${encodeURIComponent(prd)}/collab`, {
            method: "POST",
            body: JSON.stringify(body),
          }));
          return;
        }
      }
      if (req.method === "GET" && url.pathname === "/api/checkpoints") {
        const repo = url.searchParams.get("repo");
        if (!repo) {
          sendJson(res, { error: "repo is required" }, 400);
          return;
        }
        const config = await requireAuth();
        sendJson(res, await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(repo)}/checkpoints`));
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/quickstart") {
        sendJson(res, { steps: quickstartSteps() });
        return;
      }
      sendJson(res, { error: "Not found" }, 404);
    } catch (error) {
      sendJson(res, { error: error.message || String(error) }, 500);
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}/`;
  return { server, url };
}

async function requireAuth() {
  const config = await loadConfig();
  if (!config.token) {
    throw new Error("Missing token. Run `coolstory auth login --token <token>` or set COOLSTORY_TOKEN.");
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

async function cloneRepo(config, repo, args) {
  const { positional, optionArgs } = splitPositionalAndOptions(args);
  const options = parseOptions(optionArgs);
  const ref = options.ref ?? "main";
  const directory = positional[0];
  const targetDir = resolve(directory && !directory.startsWith("--") ? directory : repo);
  const archiveName = `${repo}-${ref.replace(/[^a-zA-Z0-9._-]+/g, "-")}-${Date.now()}.tar`;
  const archivePath = join(targetDir, ".coolstory", archiveName);
  await mkdir(dirname(archivePath), { recursive: true });
  const path = `/api/public/git/repos/${encodeURIComponent(repo)}/archive?ref=${encodeURIComponent(ref)}`;
  await download(config, path, archivePath);
  await extractTar(archivePath, targetDir, Boolean(options["keep-archive"]));
  console.log(`Cloned ${repo}@${ref} into ${targetDir}`);
}

function splitPositionalAndOptions(args) {
  const positional = [];
  const optionArgs = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value?.startsWith("--")) {
      optionArgs.push(value);
      if (args[index + 1] && !args[index + 1].startsWith("--")) optionArgs.push(args[++index]);
    } else {
      positional.push(value);
    }
  }
  return { positional, optionArgs };
}

async function extractTar(archivePath, targetDir, keepArchive) {
  await mkdir(targetDir, { recursive: true });
  await runCommand("tar", ["-xf", archivePath, "-C", targetDir, "--strip-components=1"]);
  if (!keepArchive) {
    await rm(archivePath, { force: true });
  }
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

function inferMarkdownTitle(content, filePath) {
  const heading = content.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim();
  if (heading) return heading.replace(/^PRD:\s*/i, "").trim();
  return basename(filePath).replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Untitled artifact";
}

function inferArtifactKind(filePath) {
  const name = basename(filePath).toLowerCase();
  if (name.includes("architecture")) return "architecture";
  if (name.includes("frontend") || name.includes("front-end")) return "frontend_spec";
  if (name.includes("brief")) return "project_brief";
  if (name.includes("design")) return "design_doc";
  if (name.includes("rfc")) return "rfc";
  if (name.includes("rfd") || name.includes("decision")) return "rfd";
  if (name.includes("epic")) return "epic";
  if (name.includes("story")) return "story";
  if (name.includes("qa")) return "qa_gate";
  if (name.includes("retro")) return "retrospective";
  if (name.includes("note")) return "note";
  return "prd";
}

function artifactKinds() {
  return [
    "project_brief",
    "prd",
    "architecture",
    "frontend_spec",
    "design_doc",
    "rfc",
    "rfd",
    "epic",
    "story",
    "qa_gate",
    "retrospective",
    "note",
  ];
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "untitled";
}

function sendJson(res, body, status = 200) {
  send(res, status, JSON.stringify(body), "application/json");
}

function send(res, status, body, contentType) {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function openExternal(url) {
  if (process.versions?.electron) {
    try {
      const { shell } = await import("electron");
      await shell.openExternal(url);
      return true;
    } catch {
      // Fall back to OS launch below.
    }
  }
  const command = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", () => {
    console.log(`Open this URL in your browser: ${url}`);
  });
  child.unref();
  return true;
}

async function runCommand(command, args) {
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolveExit(signal ? 1 : code ?? 1));
  }).catch((error) => {
    if (command === "tar") {
      throw new Error("Unable to extract archive because `tar` is not available on PATH. Use `coolstory repos archive` and extract it manually.");
    }
    throw error;
  });
  if (exitCode !== 0) {
    throw new Error(`${command} exited with code ${exitCode}`);
  }
}

function openAppWindow(url) {
  const launched = process.platform === "win32"
    ? openWindowsBrowserWindow(url)
    : process.platform === "darwin"
      ? openMacBrowserWindow(url)
      : openLinuxBrowserWindow(url);
  if (!launched) openExternal(url);
}

function openWindowsBrowserWindow(url) {
  const local = process.env.LOCALAPPDATA ?? "";
  const programFiles = process.env.PROGRAMFILES ?? "C:\\Program Files";
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
  const candidates = [
    join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    join(local, "Google", "Chrome", "Application", "chrome.exe"),
  ];
  for (const exe of candidates) {
    if (!exe || !existsSync(exe)) continue;
    spawn(exe, [url, "--new-window", "--window-size=1440,900", "--window-position=80,40"], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return true;
  }
  return false;
}

function openMacBrowserWindow(url) {
  for (const app of ["Google Chrome", "Microsoft Edge"]) {
    if (!existsSync(`/Applications/${app}.app`) && !existsSync(join(homedir(), "Applications", `${app}.app`))) continue;
    const child = spawn("open", ["-na", app, "--args", "--new-window", url, "--window-size=1440,900"], { detached: true, stdio: "ignore", windowsHide: true });
    child.on("error", () => {});
    child.unref();
    return true;
  }
  return false;
}

function openLinuxBrowserWindow(url) {
  for (const command of ["google-chrome", "microsoft-edge", "chromium", "chromium-browser"]) {
    try {
      const child = spawn(command, ["--new-window", url, "--window-size=1440,900"], { detached: true, stdio: "ignore", windowsHide: true });
      child.on("error", () => {});
      child.unref();
      return true;
    } catch {
      // Try the next browser command.
    }
  }
  return false;
}

function quickstartSteps() {
  return [
    {
      title: "Connect the client",
      body: "Use the browser approval page opened by this desktop app. The client stores a scoped CoolStory token locally.",
    },
    {
      title: "Pick a project",
      body: "Load company projects, fetch artifact context, and clone a tenant-checked snapshot when the agent needs local source files.",
    },
    {
      title: "Work branch-first",
      body: "Have the agent implement against the PRD, then checkpoint files back to CoolStory for review.",
    },
    {
      title: "Review in CoolStory",
      body: "Use comments, checkpoints, history, and pull requests in the web app to collaborate with the team.",
    },
  ];
}

function defaultSkillsText() {
  return `# CoolStory BMAD Client Skill

Use CoolStory as the source of truth for BMAD artifacts, branch context, checkpoints, and review handoff.

1. Authenticate with \`coolstory auth login --token <token>\` or \`COOLSTORY_TOKEN\`.
2. Load context with \`coolstory context <repo> [artifact]\`.
3. Clone source snapshots with \`coolstory clone <repo> ./workspace --ref <branch>\` when source context is needed.
4. Read or pull artifacts with \`coolstory artifacts get <repo> <artifact>\` or \`coolstory artifacts pull <repo> <artifact>\`.
5. Push created or rewritten Markdown artifacts with \`coolstory artifacts push <repo> <file.md> --kind <kind> --branch <branch>\`.
6. Queue implementation checkpoints with \`coolstory checkpoint "Title" --repo <repo> --branch <branch> --file <path>\`.
`;
}

function desktopHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CoolStory Desktop</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #03090b;
      --shell: #0d1519;
      --panel: #111a20;
      --panel-2: #172129;
      --panel-3: #0a1115;
      --border: #26333c;
      --border-strong: #46545f;
      --text: #f5f8fb;
      --muted: #a8b8cc;
      --muted-2: #7890a8;
      --yellow: #ffcc00;
      --green: #35d889;
      --cyan: #18c5d8;
      --danger: #ff6b7f;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px),
        var(--bg);
      background-size: 64px 64px;
      color: var(--text);
      font: 16px/1.45 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
    }
    button, input, select { font: inherit; }
    .stage { min-height: 100vh; padding: 0; }
    .app {
      --left-w: clamp(240px, 20vw, 340px);
      --right-w: clamp(300px, 24vw, 400px);
      min-height: 100vh;
      overflow: hidden;
      display: grid;
      grid-template-rows: 56px 1fr;
      border: 0;
      border-radius: 0;
      background: var(--shell);
      box-shadow: none;
    }
    .topbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      border-bottom: 1px solid var(--border);
      background: #121b21;
      padding: 0 24px;
    }
    .app-title {
      min-width: 0;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0;
    }
    .app-title strong { color: #fff; font-weight: 800; margin-right: 12px; }
    .app-title .branch { color: var(--yellow); font-weight: 800; }
    .avatars { display: flex; justify-content: flex-end; align-items: center; }
    .avatar {
      width: 38px;
      height: 38px;
      margin-left: -6px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      color: #071015;
      font: 700 13px/1 ui-sans-serif, system-ui, sans-serif;
    }
    .avatar.cyan { background: var(--cyan); }
    .avatar.yellow { background: var(--yellow); }
    .avatar.green { background: #3fc97f; }
    .body { display: grid; grid-template-columns: var(--left-w) 6px minmax(0, 1fr) 6px var(--right-w); min-height: 0; }
    .app.left-collapsed .body { grid-template-columns: 0 0 minmax(0, 1fr) 6px var(--right-w); }
    .app.right-collapsed .body { grid-template-columns: var(--left-w) 6px minmax(0, 1fr) 0 0; }
    .app.left-collapsed.right-collapsed .body { grid-template-columns: 0 0 minmax(0, 1fr) 0 0; }
    .resize-handle {
      cursor: col-resize;
      background: transparent;
      position: relative;
    }
    .resize-handle::after {
      content: "";
      position: absolute;
      inset: 0 2px;
      background: var(--border);
      opacity: .55;
    }
    .resize-handle:hover::after { background: var(--yellow); opacity: .9; }
    .app.left-collapsed #leftResize,
    .app.right-collapsed #rightResize { cursor: default; }
    .app.left-collapsed #leftResize::after,
    .app.right-collapsed #rightResize::after { display: none; }
    aside.sidebar {
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--border);
      background: #0e161a;
      padding: 20px 16px;
      overflow: auto;
    }
    .app.left-collapsed aside.sidebar { padding: 0; border-right: 0; overflow: hidden; }
    nav { display: grid; gap: 4px; }
    nav button {
      width: 100%;
      min-height: 46px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--muted);
      text-align: left;
      padding: 10px 17px;
      cursor: pointer;
      font-size: 15px;
    }
    nav button.active, nav button:hover { background: #172027; color: #fff; }
    .nav-section { margin: 18px 0 8px; color: var(--muted-2); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .nav-list { display: grid; gap: 4px; }
    .nav-list button {
      width: 100%;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: var(--muted);
      text-align: left;
      padding: 8px 10px;
      cursor: pointer;
      font-size: 13px;
    }
    .nav-list button:hover, .nav-list button.active { background: #172027; color: #fff; }
    .sidebar-footer { margin-top: auto; display: grid; gap: 14px; align-items: start; }
    .status { max-width: 100%; color: var(--muted); font-size: 13px; }
    main {
      min-width: 0;
      overflow: auto;
      padding: 28px 32px 40px;
      background: #0a1216;
    }
    .workspace { max-width: 1040px; }
    .rail {
      border-left: 1px solid var(--border);
      background: #111a20;
      padding: 20px;
      overflow: auto;
    }
    .app.right-collapsed .rail { padding: 0; border-left: 0; overflow: hidden; }
    .rail-actions { display: flex; gap: 10px; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .top-actions { display: flex; gap: 8px; align-items: center; }
    .icon-button {
      width: 34px;
      height: 34px;
      display: inline-grid;
      place-items: center;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: var(--panel-2);
      color: var(--muted);
      cursor: pointer;
    }
    .icon-button:hover { color: #fff; border-color: var(--yellow); }
    .doc-path { color: var(--muted); margin: 0 0 22px; }
    h1 {
      margin: 0 0 21px;
      font: 34px/1.15 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0;
      color: #fff;
    }
    h2 { font-size: 18px; margin: 0 0 12px; color: #fff; }
    p { color: var(--muted); margin: 0 0 22px; }
    .lede { max-width: 880px; font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--muted); }
    .inline-chip {
      display: inline-flex;
      align-items: center;
      padding: 0 7px 2px;
      border-radius: 6px;
      color: #fff;
      font-weight: 800;
      line-height: 1.15;
    }
    .inline-chip.gold { background: rgba(255,204,0,.27); }
    .inline-chip.green { background: rgba(53,216,137,.32); }
    .checkpoint {
      margin: 28px 0 30px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #0c1216;
      padding: 20px;
      color: var(--muted);
      font-size: 18px;
    }
    .checkpoint strong { color: #24ef8d; font-weight: 700; }
    .checkpoint .ai { color: var(--yellow); font-weight: 800; }
    .actions, .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .hero-actions { margin-bottom: 30px; }
    input, select {
      background: var(--panel-3);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 10px 11px;
      min-width: 260px;
    }
    .doc-editor {
      width: 100%;
      min-height: 52vh;
      resize: vertical;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #050b0f;
      color: var(--text);
      padding: 20px;
      font: 15px/1.7 ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
      outline: none;
    }
    .doc-editor:focus { border-color: var(--yellow); }
    button.primary, button.secondary, button.danger {
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 11px 18px;
      color: var(--text);
      cursor: pointer;
    }
    button.primary { background: var(--yellow); color: #080b0d; border-color: var(--yellow); font-weight: 800; }
    button.secondary { background: var(--panel-2); }
    button.danger { background: transparent; color: var(--danger); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .pill {
      display: inline-flex;
      max-width: 100%;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--muted);
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ok { color: var(--green); }
    .warn { color: var(--yellow); }
    .panel-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 24px; }
    .card { border: 1px solid var(--border); background: var(--panel); border-radius: 8px; padding: 16px; }
    .wide { grid-column: 1 / -1; }
    .list { display: grid; gap: 8px; }
    .item { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: #12151a; cursor: pointer; }
    .item:hover { border-color: var(--yellow); }
    .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; color: var(--muted); }
    .inspector-card { border: 1px solid var(--border); border-radius: 8px; background: #0c1419; padding: 14px; margin-bottom: 12px; }
    .inspector-card .meta { color: var(--muted); margin-bottom: 6px; font-size: 12px; text-transform: uppercase; }
    .inspector-card .body-text { color: #fff; font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; }
    .hide { display: none; }
    @media (max-width: 1260px) {
      .body { grid-template-columns: 260px minmax(0, 1fr); }
      .rail { display: none; }
      nav button { font-size: 17px; }
    }
    @media (max-width: 760px) {
      .topbar { grid-template-columns: minmax(0, 1fr) auto; padding: 0 14px; }
      .body { grid-template-columns: 1fr; }
      aside.sidebar { border-right: 0; border-bottom: 1px solid var(--border); padding: 18px; }
      nav { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      main { padding: 24px 18px; }
      h1 { font-size: 34px; }
      .lede { font-size: 19px; }
      .panel-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="stage">
    <div class="app">
      <header class="topbar">
        <div class="app-title"><strong>CoolStory</strong><span id="contextRepo">Desktop</span> - <span class="branch" id="contextBranch">connect a session</span></div>
        <div class="top-actions">
          <button class="icon-button" id="toggleLeft" title="Collapse artifact navigation" aria-label="Toggle artifact navigation">☰</button>
          <button class="icon-button" id="toggleRight" title="Collapse inspector" aria-label="Toggle inspector">ⓘ</button>
          <div class="avatars" id="profileAvatars" aria-label="Active collaborators">
            <span class="avatar cyan" id="profileAvatar">CS</span>
          </div>
        </div>
      </header>
      <div class="body">
        <aside class="sidebar">
          <div class="nav-section">Workspace</div>
          <nav>
            <button data-view="home" class="active">Workspace</button>
            <button data-view="projects">Projects</button>
            <button data-view="checkpoints">Checkpoints</button>
            <button data-view="quickstart">Quickstart</button>
            <button data-view="settings">Settings</button>
          </nav>
          <div class="nav-section">Artifact Types</div>
          <div id="artifactTypeNav" class="nav-list"><button disabled>Load a project</button></div>
          <div class="nav-section">Artifacts</div>
          <div id="sidebarArtifactNav" class="nav-list"><button disabled>No artifacts loaded</button></div>
          <div class="sidebar-footer">
            <span class="pill" id="desktopMode">Desktop session</span>
            <div class="status" id="sidebarStatus">Checking session...</div>
          </div>
        </aside>
        <div class="resize-handle" id="leftResize" title="Resize navigation"></div>
        <main>
          <div class="workspace">
            <section id="home">
              <p class="doc-path" id="homePath">desktop/session</p>
              <h1 id="homeTitle">Connect CoolStory</h1>
              <p class="lede" id="homeLead">Authenticate in your browser, choose a company project, and load the artifacts your account is allowed to access.</p>
              <div class="checkpoint">
                <div><strong id="workspaceStatus">+ waiting for authenticated workspace</strong></div>
                <div id="workspaceDetail">No project is loaded in this desktop session yet.</div>
                <div class="ai" id="workspaceAction">AI: Connect, then load projects to start agent work.</div>
              </div>
              <div class="actions hero-actions">
                <button class="primary" data-jump="projects">Open projects</button>
                <button class="secondary" data-jump="quickstart">Quickstart</button>
              </div>
              <div class="panel-grid">
                <div class="card">
                  <h2>Session</h2>
                  <div id="sessionState" class="pill">Checking</div>
                  <p id="profileText" style="margin-top:12px"></p>
                <button class="primary" id="connectBtn">Open browser sign-in</button>
                </div>
                <div class="card">
                  <h2>Agent Context</h2>
                  <p>Browse company-scoped projects, artifacts, checkpoints, and branch guidance from the authenticated CoolStory API.</p>
                  <button class="secondary" data-jump="projects">Open projects</button>
                </div>
                <div class="card wide hide" id="authPanel">
                  <h2>Approve Connection</h2>
                  <p>The browser approval page will connect this desktop session after you sign in.</p>
                  <div class="row">
                    <span class="pill mono" id="userCode"></span>
                    <span class="pill" id="authStatus">Waiting for approval</span>
                  </div>
                  <p style="margin-top:12px"><a id="approvalLink" href="#" target="_blank" rel="noreferrer">Open approval page</a></p>
                </div>
              </div>
            </section>
            <section id="projects" class="hide">
              <p class="doc-path" id="reposPath">projects</p>
              <h1>Projects</h1>
              <p class="lede">Load only the projects your Auth0 organization and CoolStory permissions allow this desktop client to see.</p>
              <div class="row" style="margin-bottom:14px">
                <button class="primary" id="loadProjects">Load projects</button>
                <select id="projectSelect"></select>
                <button class="secondary" id="loadPrds">Load artifacts</button>
              </div>
              <div class="panel-grid">
                <div class="card">
                  <h2>Project List</h2>
                  <div id="projectList" class="list"></div>
                </div>
                <div class="card">
                  <h2>Artifacts</h2>
                  <div id="prdList" class="list"></div>
                </div>
              </div>
            </section>
            <section id="artifacts" class="hide">
              <p class="doc-path" id="artifactsPath">artifacts</p>
              <h1>Artifacts</h1>
              <p class="lede">Select a project, then load the artifacts available to your CoolStory session.</p>
              <div class="row" style="margin-bottom:14px">
                <button class="primary" data-jump="projects">Choose project</button>
                <button class="secondary" id="loadArtifactsView">Load artifacts</button>
              </div>
              <div class="card">
                <h2>Artifact List</h2>
                <div id="artifactViewList" class="list"></div>
              </div>
            </section>
            <section id="editor" class="hide">
              <p class="doc-path" id="editorPath">editor</p>
              <h1 id="editorTitle">Editor</h1>
              <p class="lede" id="editorLead">Open an artifact to edit it collaboratively with other CoolStory web and desktop sessions.</p>
              <div class="checkpoint">
                <div><strong id="editorSync">+ no artifact open</strong></div>
                <div id="editorMeta">Choose an artifact from the Artifacts view.</div>
                <div class="ai" id="editorRevision">rev 0</div>
              </div>
              <textarea id="artifactEditor" class="doc-editor" spellcheck="false" placeholder="Open an artifact to start editing..."></textarea>
            </section>
            <section id="checkpoints" class="hide">
              <p class="doc-path" id="checkpointsPath">checkpoints</p>
              <h1>Checkpoints</h1>
              <p class="lede">Review branch checkpoints for the selected project using the same backend endpoint as the CLI.</p>
              <div class="row" style="margin-bottom:14px">
                <button class="primary" data-jump="projects">Choose project</button>
                <button class="secondary" id="loadCheckpoints">Load checkpoints</button>
              </div>
              <div class="card">
                <h2>Checkpoint List</h2>
                <div id="checkpointList" class="list"></div>
              </div>
            </section>
            <section id="quickstart" class="hide">
              <p class="doc-path">agent/quickstart.md</p>
              <h1>Quickstart</h1>
              <p class="lede">Common ways to use CoolStory with an agent, from artifact capture to checkpoint review and branch handoff.</p>
              <div id="quickstartList" class="list"></div>
            </section>
            <section id="settings" class="hide">
              <p class="doc-path">desktop/settings.json</p>
              <h1>Settings</h1>
              <p class="lede">Control the API endpoint and the local device session used by this browser-backed desktop companion.</p>
              <div class="card">
                <label class="mono">API URL</label><br />
                <input id="apiUrl" value="${DEFAULT_API_URL}" />
                <div class="row" style="margin-top:12px">
                  <button class="primary" id="connectBtn2">Open browser sign-in</button>
                  <button class="danger" id="logoutBtn">Clear local session</button>
                </div>
              </div>
            </section>
          </div>
        </main>
        <div class="resize-handle" id="rightResize" title="Resize inspector"></div>
        <aside class="rail">
          <div class="rail-actions">
            <span class="pill" id="railState">Local app</span>
            <button class="secondary" data-jump="settings">Auth</button>
          </div>
          <div id="activityRail">
            <div class="inspector-card">
              <div class="meta">Activity</div>
              <div class="body-text">Connect and load a repo to see project context here.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
  <script>
    const state = { status: null, pollTimer: null, repos: [], artifacts: [], artifactFilter: "all", selectedRepo: null, selectedArtifact: null, editorContent: "", editorRevision: 0, editorPoll: null, editorBusy: false, editorQueuedContent: null };
    const $ = (id) => document.getElementById(id);
    document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => show(button.dataset.view)));
    document.querySelectorAll("[data-jump]").forEach((button) => button.addEventListener("click", () => show(button.dataset.jump)));
    $("toggleLeft").addEventListener("click", () => document.querySelector(".app").classList.toggle("left-collapsed"));
    $("toggleRight").addEventListener("click", () => document.querySelector(".app").classList.toggle("right-collapsed"));
    setupResize("leftResize", "--left-w", 220, 420, (event) => event.clientX);
    setupResize("rightResize", "--right-w", 260, 460, (event) => window.innerWidth - event.clientX);
    $("connectBtn").addEventListener("click", startAuth);
    $("connectBtn2").addEventListener("click", startAuth);
    $("logoutBtn").addEventListener("click", logout);
    $("loadProjects").addEventListener("click", loadProjects);
    $("loadPrds").addEventListener("click", () => selectAndLoadArtifacts($("projectSelect").value));
    $("loadArtifactsView").addEventListener("click", () => loadPrds(state.selectedRepo?.slug));
    $("loadCheckpoints").addEventListener("click", () => loadCheckpoints(state.selectedRepo?.slug));
    $("artifactEditor").addEventListener("input", (event) => editArtifact(event.target.value));

    function show(view) {
      document.querySelectorAll("main section").forEach((section) => section.classList.toggle("hide", section.id !== view));
      document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
      if (view === "quickstart") loadQuickstart();
      if (view === "artifacts" && state.selectedRepo?.slug) loadPrds(state.selectedRepo.slug);
      if (view === "checkpoints" && state.selectedRepo?.slug) loadCheckpoints(state.selectedRepo.slug);
    }
    async function api(path, options = {}) {
      const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Request failed");
      return body;
    }
    async function refreshStatus() {
      state.status = await api("/api/status");
      $("apiUrl").value = state.status.apiUrl || "${DEFAULT_API_URL}";
      $("sidebarStatus").innerHTML = state.status.authenticated ? '<span class="ok">Connected</span><br>' + escapeHtml(state.status.profile?.display_name || "CoolStory user") : '<span class="warn">Not connected</span>';
      $("sessionState").textContent = state.status.authenticated ? "Connected" : "Not connected";
      $("sessionState").className = "pill " + (state.status.authenticated ? "ok" : "warn");
      $("profileText").textContent = state.status.authenticated ? (state.status.profile?.display_name || "CoolStory user") : "Connect through your CoolStory web session.";
      $("railState").textContent = state.status.authenticated ? "Synced" : "Local app";
      $("contextBranch").textContent = state.status.authenticated ? "session connected" : "connect a session";
      $("homeTitle").textContent = state.status.authenticated ? "Workspace Ready" : "Connect CoolStory";
      $("homeLead").textContent = state.status.authenticated ? "Choose a project to load artifacts, branch context, checkpoints, and agent handoff data." : "Authenticate in your browser, choose a company project, and load the artifacts your account is allowed to access.";
      $("workspaceStatus").textContent = state.status.authenticated ? "+ authenticated workspace ready" : "+ waiting for authenticated workspace";
      $("workspaceDetail").textContent = state.status.authenticated ? "No project is selected yet." : "No project is loaded in this desktop session yet.";
      $("workspaceAction").textContent = state.status.authenticated ? "AI: Load projects to start agent work." : "AI: Connect, then load projects to start agent work.";
      const name = state.status.profile?.display_name || state.status.profile?.email || "CS";
      renderAvatars([{ display_name: name, avatar_url: state.status.profile?.avatar_url || null }]);
    }
    async function startAuth() {
      try {
        $("authPanel").classList.remove("hide");
        $("authStatus").textContent = "Opening browser approval";
        const started = await api("/api/auth/start", { method: "POST", body: JSON.stringify({ apiUrl: $("apiUrl").value }) });
        $("userCode").textContent = started.user_code;
        $("approvalLink").href = started.verification_uri_complete || started.verification_uri || "#";
        $("authStatus").textContent = started.browser_opened ? "Waiting for approval" : "Open approval page";
        clearInterval(state.pollTimer);
        state.pollTimer = setInterval(() => pollAuth(started.device_code), Math.max(2, started.interval || 5) * 1000);
        pollAuth(started.device_code);
      } catch (error) {
        $("authPanel").classList.remove("hide");
        $("authStatus").textContent = error.message;
      }
    }
    async function pollAuth(deviceCode) {
      try {
        const result = await api("/api/auth/poll", { method: "POST", body: JSON.stringify({ device_code: deviceCode }) });
        if (result.access_token) {
          clearInterval(state.pollTimer);
          $("authStatus").textContent = "Connected";
          await refreshStatus();
        }
      } catch (error) {
        if (!String(error.message).includes("authorization_pending")) {
          $("authStatus").textContent = error.message;
        }
      }
    }
    async function logout() {
      await api("/api/logout", { method: "POST", body: "{}" });
      await refreshStatus();
    }
    async function loadProjects() {
      try {
        const data = await api("/api/repos");
        const repos = data.repos || [];
        state.repos = repos;
        $("projectList").innerHTML = repos.map((repo) => '<div class="item" data-repo="' + escapeHtml(repo.slug) + '"><strong>' + escapeHtml(repo.name) + '</strong><div class="mono">' + escapeHtml(repo.slug) + ' - ' + escapeHtml(repo.default_branch) + ' - ' + escapeHtml(repo.visibility || "project") + '</div><div class="mono">' + (repo.members || []).slice(0, 4).map((member) => escapeHtml(member.display_name || "CoolStory user")).join(" - ") + '</div></div>').join("") || '<p>No projects found.</p>';
        $("projectSelect").innerHTML = repos.map((repo) => '<option value="' + escapeHtml(repo.slug) + '">' + escapeHtml(repo.name) + '</option>').join("");
        $("activityRail").innerHTML = '<div class="inspector-card"><div class="meta">Projects</div><div class="body-text">' + repos.length + ' available project' + (repos.length === 1 ? '' : 's') + ' loaded for this session.</div></div>';
        if (repos[0]) setSelectedRepo(repos[0].slug, repos[0].name, repos[0].default_branch);
        document.querySelectorAll("[data-repo]").forEach((el) => el.addEventListener("click", () => {
          selectAndLoadArtifacts(el.dataset.repo);
        }));
      } catch (error) {
        $("projectList").innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
        $("activityRail").innerHTML = '<div class="inspector-card"><div class="meta">Projects</div><div class="body-text">' + escapeHtml(error.message) + '</div></div>';
      }
    }
    function selectAndLoadArtifacts(slug) {
      const repo = state.repos.find((item) => item.slug === slug);
      if (repo) {
        $("projectSelect").value = repo.slug;
        setSelectedRepo(repo.slug, repo.name, repo.default_branch);
      }
      loadPrds(slug);
    }
    async function loadPrds(repo) {
      if (!repo) {
        $("artifactViewList").innerHTML = '<p>Choose a project first.</p>';
        $("prdList").innerHTML = '<p>Choose a project first.</p>';
        return;
      }
      try {
        const data = await api("/api/prds?repo=" + encodeURIComponent(repo));
        const prds = data.prds || [];
        state.artifacts = prds;
        state.artifactFilter = "all";
        renderArtifactNavigation(repo);
        renderArtifactLists(repo);
        $("activityRail").innerHTML = '<div class="inspector-card"><div class="meta">Artifacts</div><div class="body-text">' + prds.length + ' artifact' + (prds.length === 1 ? '' : 's') + ' loaded for ' + escapeHtml(repo) + '.</div></div>';
      } catch (error) {
        const html = '<p>' + escapeHtml(error.message) + '</p>';
        $("prdList").innerHTML = html;
        $("artifactViewList").innerHTML = html;
        $("artifactTypeNav").innerHTML = '<button disabled>Unable to load types</button>';
        $("sidebarArtifactNav").innerHTML = '<button disabled>Unable to load artifacts</button>';
      }
    }
    function renderArtifactNavigation(repo) {
      const counts = state.artifacts.reduce((acc, item) => {
        const key = item.kind || "artifact";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const typeButtons = [['all', 'All artifacts', state.artifacts.length]].concat(Object.entries(counts).map(([kind, count]) => [kind, artifactLabel(kind), count]));
      $("artifactTypeNav").innerHTML = typeButtons.map(([kind, label, count]) => '<button data-kind="' + escapeHtml(kind) + '" class="' + (state.artifactFilter === kind ? 'active' : '') + '">' + escapeHtml(label) + ' <span class="mono">' + count + '</span></button>').join("") || '<button disabled>No artifact types</button>';
      document.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => {
        state.artifactFilter = button.dataset.kind;
        renderArtifactNavigation(repo);
        renderArtifactLists(repo);
        show("artifacts");
      }));
    }
    function renderArtifactLists(repo) {
      const filtered = state.artifactFilter === "all" ? state.artifacts : state.artifacts.filter((item) => (item.kind || "artifact") === state.artifactFilter);
      const html = filtered.map((prd) => '<div class="item" data-prd="' + escapeHtml(prd.slug) + '"><strong>' + escapeHtml(prd.title) + '</strong><div class="mono">' + escapeHtml(artifactLabel(prd.kind)) + ' - ' + escapeHtml(prd.slug) + ' - ' + escapeHtml(prd.status) + ' - ' + escapeHtml(prd.branch_name) + '</div></div>').join("") || '<p>No artifacts found.</p>';
      const navHtml = filtered.map((prd) => '<button data-nav-prd="' + escapeHtml(prd.slug) + '">' + escapeHtml(artifactLabel(prd.kind)) + ' - ' + escapeHtml(prd.title) + '</button>').join("") || '<button disabled>No artifacts</button>';
      $("prdList").innerHTML = html;
      $("artifactViewList").innerHTML = html;
      $("sidebarArtifactNav").innerHTML = navHtml;
      document.querySelectorAll("[data-prd]").forEach((el) => el.addEventListener("click", () => openArtifactEditor(repo, el.dataset.prd)));
      document.querySelectorAll("[data-nav-prd]").forEach((el) => el.addEventListener("click", () => openArtifactEditor(repo, el.dataset.navPrd)));
    }
    async function loadCheckpoints(repo) {
      if (!repo) {
        $("checkpointList").innerHTML = '<p>Choose a repo first.</p>';
        return;
      }
      try {
        const data = await api("/api/checkpoints?repo=" + encodeURIComponent(repo));
        const checkpoints = data.checkpoints || [];
        $("checkpointList").innerHTML = checkpoints.map((checkpoint) => '<div class="item"><strong>' + escapeHtml(checkpoint.title || checkpoint.branch) + '</strong><div class="mono">' + escapeHtml(checkpoint.status) + ' - ' + escapeHtml(checkpoint.branch) + ' - ' + escapeHtml(checkpoint.commit_sha || "pending") + '</div></div>').join("") || '<p>No checkpoints found.</p>';
        $("activityRail").innerHTML = '<div class="inspector-card"><div class="meta">Checkpoints</div><div class="body-text">' + checkpoints.length + ' checkpoint' + (checkpoints.length === 1 ? '' : 's') + ' loaded for ' + escapeHtml(repo) + '.</div></div>';
      } catch (error) {
        $("checkpointList").innerHTML = '<p>' + escapeHtml(error.message) + '</p>';
      }
    }
    async function openArtifactEditor(repo, prd) {
      if (!repo || !prd) return;
      const data = await api("/api/prd?repo=" + encodeURIComponent(repo) + "&prd=" + encodeURIComponent(prd));
      state.selectedArtifact = { repo, prd, title: data.prd.title };
      state.editorContent = data.prd.content || "";
      state.editorRevision = data.prd.collab_revision || 0;
      $("artifactEditor").value = state.editorContent;
      $("editorTitle").textContent = data.prd.title || prd;
      $("editorPath").textContent = "repos/" + repo + "/artifacts/" + prd;
      $("editorMeta").textContent = data.prd.status + " - " + data.prd.branch_name;
      $("editorSync").textContent = "+ live collaborative editor";
      $("editorRevision").textContent = "rev " + state.editorRevision;
      clearInterval(state.editorPoll);
      state.editorPoll = setInterval(pollArtifactEditor, 1000);
      show("editor");
    }
    async function pollArtifactEditor() {
      if (!state.selectedArtifact || state.editorBusy || state.editorQueuedContent !== null) return;
      try {
        const { repo, prd } = state.selectedArtifact;
        const data = await api("/api/collab?repo=" + encodeURIComponent(repo) + "&prd=" + encodeURIComponent(prd) + "&after_revision=" + encodeURIComponent(state.editorRevision));
        const ops = data.ops || [];
        if (ops.length) {
          let next = state.editorContent;
          for (const op of ops) next = applyTextEdit(next, op);
          state.editorContent = next;
          state.editorRevision = data.prd.revision;
          $("artifactEditor").value = next;
        } else if (data.prd.revision > state.editorRevision && data.prd.content !== state.editorContent) {
          state.editorContent = data.prd.content;
          state.editorRevision = data.prd.revision;
          $("artifactEditor").value = data.prd.content;
        }
        $("editorSync").textContent = "+ synced with web and desktop sessions";
        $("editorRevision").textContent = "rev " + state.editorRevision;
      } catch (error) {
        $("editorSync").textContent = "+ sync paused: " + error.message;
      }
    }
    async function editArtifact(nextContent) {
      if (!state.selectedArtifact) return;
      if (state.editorBusy) {
        state.editorQueuedContent = nextContent;
        $("editorSync").textContent = "+ edit queued";
        return;
      }
      const before = state.editorContent;
      if (before === nextContent) return;
      const op = diffText(before, nextContent);
      state.editorContent = nextContent;
      state.editorBusy = true;
      $("editorSync").textContent = "+ syncing edit";
      try {
        const { repo, prd } = state.selectedArtifact;
        const data = await api("/api/collab?repo=" + encodeURIComponent(repo) + "&prd=" + encodeURIComponent(prd), {
          method: "POST",
          body: JSON.stringify({ base_revision: state.editorRevision, ...op }),
        });
        state.editorContent = data.content;
        state.editorRevision = data.revision;
        $("artifactEditor").value = data.content;
        $("editorSync").textContent = "+ live collaborative editor";
        $("editorRevision").textContent = "rev " + data.revision;
      } catch (error) {
        $("editorSync").textContent = "+ edit failed: " + error.message;
      } finally {
        state.editorBusy = false;
        if (state.editorQueuedContent !== null && state.editorQueuedContent !== state.editorContent) {
          const queued = state.editorQueuedContent;
          state.editorQueuedContent = null;
          editArtifact(queued);
        } else {
          state.editorQueuedContent = null;
        }
      }
    }
    function applyTextEdit(content, op) {
      const start = Math.max(0, Math.min(op.start_index, content.length));
      const end = Math.max(start, Math.min(start + op.delete_count, content.length));
      return content.slice(0, start) + op.insert_text + content.slice(end);
    }
    function diffText(before, after) {
      let start = 0;
      while (start < before.length && start < after.length && before[start] === after[start]) start++;
      let beforeEnd = before.length;
      let afterEnd = after.length;
      while (beforeEnd > start && afterEnd > start && before[beforeEnd - 1] === after[afterEnd - 1]) {
        beforeEnd--;
        afterEnd--;
      }
      return { start_index: start, delete_count: beforeEnd - start, insert_text: after.slice(start, afterEnd) };
    }
    async function loadQuickstart() {
      const data = await api("/api/quickstart");
      $("quickstartList").innerHTML = data.steps.map((step, i) => '<div class="card"><span class="pill">Step ' + (i + 1) + '</span><h2 style="margin-top:10px">' + escapeHtml(step.title) + '</h2><p>' + escapeHtml(step.body) + '</p></div>').join("");
    }
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
    function initials(value) {
      const parts = String(value || "CS").trim().split(/\\s+|@/).filter(Boolean);
      return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CS";
    }
    function artifactLabel(kind) {
      const labels = {
        project_brief: "Project Brief",
        prd: "PRD",
        architecture: "Architecture",
        frontend_spec: "Front-end Spec",
        design_doc: "Design Doc",
        rfc: "RFC",
        rfd: "RFD",
        epic: "Epic",
        story: "Story",
        qa_gate: "QA Gate",
        retrospective: "Retro",
        note: "Note"
      };
      return labels[kind] || kind || "Artifact";
    }
    function setupResize(handleId, cssVar, min, max, measure) {
      const handle = $(handleId);
      const app = document.querySelector(".app");
      handle.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        handle.setPointerCapture(event.pointerId);
        const move = (moveEvent) => {
          const width = Math.max(min, Math.min(max, measure(moveEvent)));
          app.style.setProperty(cssVar, width + "px");
        };
        const up = (upEvent) => {
          handle.releasePointerCapture(upEvent.pointerId);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    }
    function renderAvatars(members) {
      const colors = ["cyan", "yellow", "green"];
      const html = (members || []).slice(0, 5).map((member, index) => {
        const label = initials(member.display_name || member.email || "CS");
        const title = escapeHtml(member.display_name || "CoolStory user");
        if (member.avatar_url) return '<span class="avatar ' + colors[index % colors.length] + '" title="' + title + '" style="background-image:url(' + escapeHtml(member.avatar_url) + ');background-size:cover;background-position:center;color:transparent">' + escapeHtml(label) + '</span>';
        return '<span class="avatar ' + colors[index % colors.length] + '" title="' + title + '">' + escapeHtml(label) + '</span>';
      }).join("");
      $("profileAvatars").innerHTML = html || '<span class="avatar cyan">CS</span>';
    }
    function setSelectedRepo(slug, name, branch) {
      const repo = state.repos.find((item) => item.slug === slug);
      $("contextRepo").textContent = name || slug || "CoolStory Desktop";
      $("contextBranch").textContent = branch || "repo selected";
      state.selectedRepo = slug ? { slug, name, default_branch: branch } : null;
      state.artifacts = [];
      state.artifactFilter = "all";
      $("artifactTypeNav").innerHTML = '<button disabled>Load artifacts</button>';
      $("sidebarArtifactNav").innerHTML = '<button disabled>No artifacts loaded</button>';
      renderAvatars(repo?.members?.length ? repo.members : [{ display_name: state.status?.profile?.display_name || "CS", avatar_url: state.status?.profile?.avatar_url || null }]);
      $("homePath").textContent = slug ? "repos/" + slug : "desktop/session";
      $("artifactsPath").textContent = slug ? "repos/" + slug + "/artifacts" : "artifacts";
      $("checkpointsPath").textContent = slug ? "repos/" + slug + "/checkpoints" : "checkpoints";
      $("workspaceStatus").textContent = slug ? "+ project selected" : "+ authenticated workspace ready";
      $("workspaceDetail").textContent = slug ? "Loaded " + (name || slug) + " into this desktop session." : "No project is selected yet.";
      $("workspaceAction").textContent = "AI: Load artifacts, checkpoints, or branch context from the project view.";
    }
    refreshStatus().catch((error) => { $("sidebarStatus").textContent = error.message; });
  </script>
</body>
</html>`;
}

if (process.env.COOLSTORY_PLUGIN_LIBRARY !== "1") {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
