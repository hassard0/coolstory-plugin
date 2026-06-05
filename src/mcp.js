#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_API_URL = "https://coolstory.dev";
const CONFIG_PATH = join(homedir(), ".coolstory", "plugin.json");

const tools = [
  {
    name: "coolstory_whoami",
    description: "Return the CoolStory user for the configured PAT.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "coolstory_list_repos",
    description: "List CoolStory repositories accessible to the configured PAT.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "coolstory_list_artifacts",
    description: "List artifacts in a CoolStory repository.",
    inputSchema: {
      type: "object",
      required: ["repo"],
      properties: { repo: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_get_artifact",
    description: "Fetch one CoolStory artifact, including Markdown content.",
    inputSchema: {
      type: "object",
      required: ["repo", "artifact"],
      properties: { repo: { type: "string" }, artifact: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_create_artifact",
    description: "Create or update a CoolStory artifact and materialize it to a branch.",
    inputSchema: {
      type: "object",
      required: ["repo", "title", "content"],
      properties: {
        repo: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        slug: { type: "string" },
        kind: { type: "string" },
        branch: { type: "string" },
        status: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_update_artifact",
    description: "Update a CoolStory artifact by slug and materialize it to a branch.",
    inputSchema: {
      type: "object",
      required: ["repo", "artifact", "title", "content"],
      properties: {
        repo: { type: "string" },
        artifact: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        kind: { type: "string" },
        branch: { type: "string" },
        status: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_search_artifacts",
    description: "Search artifact titles, slugs, kinds, and content snippets in one repository.",
    inputSchema: {
      type: "object",
      required: ["repo", "query"],
      properties: {
        repo: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_context",
    description: "Fetch repo refs, artifact list, and optional artifact body for agent context.",
    inputSchema: {
      type: "object",
      required: ["repo"],
      properties: { repo: { type: "string" }, artifact: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_list_checkpoints",
    description: "List recent checkpoints in a CoolStory repository.",
    inputSchema: {
      type: "object",
      required: ["repo"],
      properties: { repo: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_create_checkpoint",
    description: "Queue a CoolStory checkpoint for a repo branch.",
    inputSchema: {
      type: "object",
      required: ["repo", "title"],
      properties: {
        repo: { type: "string" },
        title: { type: "string" },
        branch: { type: "string" },
        summary: { type: "string" },
        files: { type: "array", items: { type: "string" } },
        artifacts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              path: { type: "string" },
              title: { type: "string" },
              slug: { type: "string" },
              kind: { type: "string" },
              content: { type: "string" },
            },
            required: ["content"],
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "coolstory_propose_change",
    description: "Create a CoolStory pull request for an artifact branch change.",
    inputSchema: {
      type: "object",
      required: ["repo", "artifact", "source_branch", "title"],
      properties: {
        repo: { type: "string" },
        artifact: { type: "string" },
        source_branch: { type: "string" },
        target_branch: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

let inputBuffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  void drainMessages();
});

process.stdin.resume();

async function drainMessages() {
  while (true) {
    const headerEnd = inputBuffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;

    const headers = inputBuffer.subarray(0, headerEnd).toString("utf8");
    const contentLength = parseContentLength(headers);
    if (!Number.isInteger(contentLength) || contentLength < 0) {
      inputBuffer = Buffer.alloc(0);
      send(null, undefined, { code: -32700, message: "Invalid MCP content-length header" });
      return;
    }

    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;
    if (inputBuffer.length < messageEnd) return;

    const payload = inputBuffer.subarray(messageStart, messageEnd).toString("utf8");
    inputBuffer = inputBuffer.subarray(messageEnd);

    let message;
    try {
      message = JSON.parse(payload);
      await handle(message);
    } catch (error) {
      send(message?.id ?? null, undefined, {
        code: -32603,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function handle(message) {
  if (message.method === "initialize") {
    send(message.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "coolstory-mcp", version: "0.1.18" },
    });
    return;
  }
  if (message.method === "notifications/initialized") return;
  if (message.method === "tools/list") {
    send(message.id, { tools });
    return;
  }
  if (message.method === "tools/call") {
    const result = await callTool(message.params?.name, message.params?.arguments ?? {});
    send(message.id, {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    });
    return;
  }
  send(message.id, undefined, { code: -32601, message: `Unknown method: ${message.method}` });
}

async function callTool(name, args) {
  const config = await requireAuth();
  if (name === "coolstory_whoami") return apiRequest(config, "/api/public/cli/whoami");
  if (name === "coolstory_list_repos") return apiRequest(config, "/api/public/cli/repos");
  if (name === "coolstory_list_artifacts") {
    requireArg(args.repo, "repo");
    return apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/prds`);
  }
  if (name === "coolstory_get_artifact") {
    requireArg(args.repo, "repo");
    requireArg(args.artifact, "artifact");
    return apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/prds/${encodeURIComponent(args.artifact)}`);
  }
  if (name === "coolstory_create_artifact") {
    requireArg(args.repo, "repo");
    requireArg(args.title, "title");
    requireArg(args.content, "content");
    return upsertArtifact(config, args, args.slug);
  }
  if (name === "coolstory_update_artifact") {
    requireArg(args.repo, "repo");
    requireArg(args.artifact, "artifact");
    requireArg(args.title, "title");
    requireArg(args.content, "content");
    return upsertArtifact(config, args, args.artifact);
  }
  if (name === "coolstory_search_artifacts") {
    requireArg(args.repo, "repo");
    requireArg(args.query, "query");
    const listed = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/prds`);
    const query = args.query.toLowerCase();
    const limit = Number.isFinite(args.limit) ? Math.max(1, Math.min(50, Math.floor(args.limit))) : 10;
    const candidates = listed.prds ?? [];
    const detailed = [];
    for (const artifact of candidates) {
      const detail = await apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/prds/${encodeURIComponent(artifact.slug)}`).catch(() => null);
      const content = detail?.prd?.content ?? "";
      if (!matchesArtifactSummary(artifact, query) && !content.toLowerCase().includes(query)) continue;
      detailed.push({
        ...artifact,
        content_snippet: snippet(content, query),
      });
      if (detailed.length >= limit) break;
    }
    return { repo: listed.repo, artifacts: detailed };
  }
  if (name === "coolstory_context") {
    requireArg(args.repo, "repo");
    const [repos, artifacts, refs, artifact] = await Promise.all([
      apiRequest(config, "/api/public/cli/repos"),
      apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/prds`),
      apiRequest(config, `/api/public/git/repos/${encodeURIComponent(args.repo)}/refs`).catch((error) => ({ error: error.message, refs: [] })),
      args.artifact
        ? apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/prds/${encodeURIComponent(args.artifact)}`)
        : Promise.resolve(null),
    ]);
    return {
      repo: (repos.repos ?? []).find((repo) => repo.slug === args.repo) ?? null,
      artifacts: artifacts.prds ?? [],
      refs: refs.refs ?? [],
      artifact: artifact?.prd ?? null,
    };
  }
  if (name === "coolstory_list_checkpoints") {
    requireArg(args.repo, "repo");
    return apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/checkpoints`);
  }
  if (name === "coolstory_create_checkpoint") {
    requireArg(args.repo, "repo");
    requireArg(args.title, "title");
    return apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/checkpoints`, {
      method: "POST",
      body: JSON.stringify({
        title: args.title,
        branch: args.branch || "main",
        summary: args.summary || "",
        files: Array.isArray(args.files) ? args.files : [],
        artifacts: Array.isArray(args.artifacts) ? args.artifacts : [],
      }),
    });
  }
  if (name === "coolstory_propose_change") {
    requireArg(args.repo, "repo");
    requireArg(args.artifact, "artifact");
    requireArg(args.source_branch, "source_branch");
    requireArg(args.title, "title");
    return apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        artifact_slug: args.artifact,
        source_branch: args.source_branch,
        target_branch: args.target_branch,
        title: args.title,
        body: args.body || "",
      }),
    });
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function upsertArtifact(config, args, slug) {
  return apiRequest(config, `/api/public/cli/repos/${encodeURIComponent(args.repo)}/prds`, {
    method: "POST",
    body: JSON.stringify({
      title: args.title,
      slug,
      kind: args.kind || "prd",
      branch_name: args.branch || "main",
      content: args.content,
      status: args.status || "draft",
    }),
  });
}

function matchesArtifactSummary(artifact, query) {
  return [artifact.title, artifact.slug, artifact.kind, artifact.status, artifact.branch_name]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function snippet(content, query) {
  if (!content) return "";
  const lower = content.toLowerCase();
  const index = lower.indexOf(query);
  if (index === -1) return content.slice(0, 240);
  return content.slice(Math.max(0, index - 100), Math.min(content.length, index + query.length + 140));
}

async function requireAuth() {
  const config = await loadConfig();
  if (!config.token) throw new Error("CoolStory PAT missing. Set COOLSTORY_TOKEN or run `coolstory auth login --token <token>`.");
  return config;
}

async function loadConfig() {
  const fromEnv = {
    apiUrl: process.env.COOLSTORY_API_URL || DEFAULT_API_URL,
    token: process.env.COOLSTORY_TOKEN || "",
  };
  if (fromEnv.token) return fromEnv;
  try {
    const saved = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
    return {
      apiUrl: saved.apiUrl || DEFAULT_API_URL,
      token: saved.token || "",
    };
  } catch {
    return fromEnv;
  }
}

async function apiRequest(config, path, init = {}) {
  const response = await fetch(new URL(path, config.apiUrl), {
    method: init.method ?? "GET",
    body: init.body,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.token}`,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || `${response.status} ${response.statusText}`);
  return data;
}

function send(id, result, error) {
  const body = JSON.stringify({ jsonrpc: "2.0", id, ...(error ? { error } : { result }) });
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function parseContentLength(headers) {
  for (const line of headers.split("\r\n")) {
    const [rawName, rawValue] = line.split(":", 2);
    if (rawName?.toLowerCase() === "content-length") return Number.parseInt(rawValue.trim(), 10);
  }
  return NaN;
}

function requireArg(value, name) {
  if (!value || typeof value !== "string") throw new Error(`${name} is required`);
}
