#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
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
  "gui": gui,
};

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const handler = commands[command ?? "gui"];
  if (!handler) {
    throw new Error(`Unknown command: ${command}`);
  }
  await handler(args);
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
  coolstory-plugin gui
  coolstory-plugin quickstart

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

async function gui() {
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
        openExternal(payload.verification_uri_complete);
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
  console.log(`CoolStory desktop client is running at ${url}`);
  openAppWindow(url);
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

function openExternal(url) {
  const command = process.platform === "win32"
    ? "cmd"
    : process.platform === "darwin"
      ? "open"
      : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {
    console.log(`Open this URL in your browser: ${url}`);
  });
  child.unref();
}

function openAppWindow(url) {
  const launched = process.platform === "win32"
    ? openWindowsAppWindow(url)
    : process.platform === "darwin"
      ? openMacAppWindow(url)
      : openLinuxAppWindow(url);
  if (!launched) openExternal(url);
}

function openWindowsAppWindow(url) {
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
    spawn(exe, [`--app=${url}`, "--new-window"], { detached: true, stdio: "ignore" }).unref();
    return true;
  }
  return false;
}

function openMacAppWindow(url) {
  for (const app of ["Google Chrome", "Microsoft Edge"]) {
    if (!existsSync(`/Applications/${app}.app`) && !existsSync(join(homedir(), "Applications", `${app}.app`))) continue;
    const child = spawn("open", ["-na", app, "--args", `--app=${url}`], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
    return true;
  }
  return false;
}

function openLinuxAppWindow(url) {
  for (const command of ["google-chrome", "microsoft-edge", "chromium", "chromium-browser"]) {
    try {
      const child = spawn(command, [`--app=${url}`], { detached: true, stdio: "ignore" });
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
      body: "Load company projects and choose the PRD or artifact your agent should use as context.",
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
      --bg: #101215;
      --panel: #171a1f;
      --panel-2: #1f242b;
      --border: #313741;
      --text: #f3f6f8;
      --muted: #a3adb8;
      --accent: #61d394;
      --accent-2: #7db7ff;
      --warn: #f7c76a;
      --danger: #ff7a90;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .shell { min-height: 100vh; display: grid; grid-template-columns: 248px 1fr; }
    aside { border-right: 1px solid var(--border); background: var(--panel); padding: 22px 18px; }
    main { padding: 28px; max-width: 1180px; width: 100%; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; margin-bottom: 28px; }
    .mark { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid var(--border); border-radius: 7px; background: var(--panel-2); color: var(--accent); }
    nav button { width: 100%; border: 0; background: transparent; color: var(--muted); text-align: left; padding: 10px 12px; border-radius: 7px; cursor: pointer; }
    nav button.active, nav button:hover { background: var(--panel-2); color: var(--text); }
    .status { margin-top: 28px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; color: var(--muted); font-size: 12px; }
    h1 { font-size: 32px; margin: 0 0 8px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    p { color: var(--muted); margin: 0 0 18px; }
    .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .card { border: 1px solid var(--border); background: var(--panel); border-radius: 8px; padding: 16px; }
    .wide { grid-column: 1 / -1; }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    input, select {
      background: #0d0f12;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 10px 11px;
      min-width: 260px;
    }
    button.primary, button.secondary, button.danger {
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 10px 12px;
      color: var(--text);
      cursor: pointer;
    }
    button.primary { background: var(--accent); color: #07110b; border-color: var(--accent); font-weight: 700; }
    button.secondary { background: var(--panel-2); }
    button.danger { background: transparent; color: var(--danger); }
    button:disabled { opacity: .55; cursor: not-allowed; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 999px; color: var(--muted); font-size: 12px; }
    .ok { color: var(--accent); }
    .warn { color: var(--warn); }
    .list { display: grid; gap: 8px; }
    .item { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: #12151a; cursor: pointer; }
    .item:hover { border-color: var(--accent-2); }
    .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 12px; color: var(--muted); }
    .hide { display: none; }
    @media (max-width: 820px) {
      .shell { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--border); }
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <div class="brand"><span class="mark">⌁</span> CoolStory</div>
      <nav>
        <button data-view="home" class="active">Home</button>
        <button data-view="projects">Projects</button>
        <button data-view="quickstart">Quickstart</button>
        <button data-view="settings">Settings</button>
      </nav>
      <div class="status" id="sidebarStatus">Checking session...</div>
    </aside>
    <main>
      <section id="home">
        <h1>CoolStory Desktop</h1>
        <p>Connect this client to your CoolStory web session, then hand project context to local agents without exposing the private app repo.</p>
        <div class="grid">
          <div class="card">
            <h2>Session</h2>
            <div id="sessionState" class="pill">Checking</div>
            <p id="profileText" style="margin-top:12px"></p>
            <button class="primary" id="connectBtn">Connect with browser</button>
          </div>
          <div class="card">
            <h2>Agent Context</h2>
            <p>Browse projects, PRDs, checkpoints, and branch guidance from the authenticated CoolStory API.</p>
            <button class="secondary" data-jump="projects">Open projects</button>
          </div>
          <div class="card">
            <h2>Secure by Default</h2>
            <p>Authentication is approved in the CoolStory web app. This client stores only the generated token in your user profile directory.</p>
          </div>
          <div class="card wide hide" id="authPanel">
            <h2>Approve Connection</h2>
            <p>Confirm the code in the browser window that just opened.</p>
            <div class="row">
              <span class="pill mono" id="userCode"></span>
              <span class="pill" id="authStatus">Waiting for approval</span>
            </div>
          </div>
        </div>
      </section>
      <section id="projects" class="hide">
        <h1>Projects</h1>
        <p>Use these as the starting point for agent work. Private projects are filtered by CoolStory permissions.</p>
        <div class="row" style="margin-bottom:14px">
          <button class="primary" id="loadProjects">Load projects</button>
          <select id="projectSelect"></select>
          <button class="secondary" id="loadPrds">Load artifacts</button>
        </div>
        <div class="grid">
          <div class="card">
            <h2>Project List</h2>
            <div id="projectList" class="list"></div>
          </div>
          <div class="card" style="grid-column: span 2">
            <h2>Artifacts</h2>
            <div id="prdList" class="list"></div>
          </div>
        </div>
      </section>
      <section id="quickstart" class="hide">
        <h1>Quickstart</h1>
        <p>Common ways to use CoolStory with an agent.</p>
        <div id="quickstartList" class="list"></div>
      </section>
      <section id="settings" class="hide">
        <h1>Settings</h1>
        <p>Control the API endpoint and local session.</p>
        <div class="card">
          <label class="mono">API URL</label><br />
          <input id="apiUrl" value="${DEFAULT_API_URL}" />
          <div class="row" style="margin-top:12px">
            <button class="primary" id="connectBtn2">Connect with browser</button>
            <button class="danger" id="logoutBtn">Clear local session</button>
          </div>
        </div>
      </section>
    </main>
  </div>
  <script>
    const state = { status: null, pollTimer: null };
    const $ = (id) => document.getElementById(id);
    document.querySelectorAll("nav button").forEach((button) => button.addEventListener("click", () => show(button.dataset.view)));
    document.querySelectorAll("[data-jump]").forEach((button) => button.addEventListener("click", () => show(button.dataset.jump)));
    $("connectBtn").addEventListener("click", startAuth);
    $("connectBtn2").addEventListener("click", startAuth);
    $("logoutBtn").addEventListener("click", logout);
    $("loadProjects").addEventListener("click", loadProjects);
    $("loadPrds").addEventListener("click", () => loadPrds($("projectSelect").value));

    function show(view) {
      document.querySelectorAll("main section").forEach((section) => section.classList.toggle("hide", section.id !== view));
      document.querySelectorAll("nav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
      if (view === "quickstart") loadQuickstart();
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
    }
    async function startAuth() {
      $("authPanel").classList.remove("hide");
      $("authStatus").textContent = "Opening browser approval";
      const started = await api("/api/auth/start", { method: "POST", body: JSON.stringify({ apiUrl: $("apiUrl").value }) });
      $("userCode").textContent = started.user_code;
      $("authStatus").textContent = "Waiting for approval";
      clearInterval(state.pollTimer);
      state.pollTimer = setInterval(() => pollAuth(started.device_code), Math.max(2, started.interval || 5) * 1000);
      pollAuth(started.device_code);
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
      const data = await api("/api/repos");
      const repos = data.repos || [];
      $("projectList").innerHTML = repos.map((repo) => '<div class="item" data-repo="' + escapeHtml(repo.slug) + '"><strong>' + escapeHtml(repo.name) + '</strong><div class="mono">' + escapeHtml(repo.slug) + ' · ' + escapeHtml(repo.default_branch) + '</div></div>').join("") || '<p>No projects found.</p>';
      $("projectSelect").innerHTML = repos.map((repo) => '<option value="' + escapeHtml(repo.slug) + '">' + escapeHtml(repo.name) + '</option>').join("");
      document.querySelectorAll("[data-repo]").forEach((el) => el.addEventListener("click", () => { $("projectSelect").value = el.dataset.repo; loadPrds(el.dataset.repo); }));
    }
    async function loadPrds(repo) {
      if (!repo) return;
      const data = await api("/api/prds?repo=" + encodeURIComponent(repo));
      const prds = data.prds || [];
      $("prdList").innerHTML = prds.map((prd) => '<div class="item"><strong>' + escapeHtml(prd.title) + '</strong><div class="mono">' + escapeHtml(prd.slug) + ' · ' + escapeHtml(prd.status) + ' · ' + escapeHtml(prd.branch_name) + '</div></div>').join("") || '<p>No artifacts found.</p>';
    }
    async function loadQuickstart() {
      const data = await api("/api/quickstart");
      $("quickstartList").innerHTML = data.steps.map((step, i) => '<div class="card"><span class="pill">Step ' + (i + 1) + '</span><h2 style="margin-top:10px">' + escapeHtml(step.title) + '</h2><p>' + escapeHtml(step.body) + '</p></div>').join("");
    }
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
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
