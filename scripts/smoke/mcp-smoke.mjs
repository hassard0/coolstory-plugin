#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const child = spawn(process.execPath, [resolve("src/mcp.js")], {
  env: {
    ...process.env,
    COOLSTORY_API_URL: process.env.COOLSTORY_API_URL || "https://coolstory.dev",
  },
  stdio: ["pipe", "pipe", "inherit"],
});

let buffer = Buffer.alloc(0);
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drainResponses();
});

try {
  const initialize = await request("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "coolstory-mcp-smoke", version: "1.0.0" },
  });
  assert(initialize.serverInfo?.name === "coolstory-mcp", "initialize did not return coolstory-mcp server info");

  notify("notifications/initialized", {});

  const listed = await request("tools/list", {});
  const toolNames = (listed.tools ?? []).map((tool) => tool.name);
  for (const expected of [
    "coolstory_whoami",
    "coolstory_list_repos",
    "coolstory_list_artifacts",
    "coolstory_get_artifact",
    "coolstory_create_artifact",
    "coolstory_update_artifact",
    "coolstory_search_artifacts",
    "coolstory_context",
    "coolstory_list_checkpoints",
    "coolstory_create_checkpoint",
    "coolstory_propose_change",
  ]) {
    assert(toolNames.includes(expected), `missing MCP tool: ${expected}`);
  }

  if (process.env.COOLSTORY_TOKEN) {
    const whoami = await request("tools/call", { name: "coolstory_whoami", arguments: {} });
    const text = whoami.content?.[0]?.text ?? "";
    assert(text.includes("user"), "authenticated MCP whoami response missing user payload");
  } else {
    const missingAuth = await request("tools/call", { name: "coolstory_whoami", arguments: {} }, { expectError: true });
    assert(String(missingAuth.error?.message || "").includes("CoolStory PAT missing"), "missing-token MCP call did not return the expected auth error");
  }

  child.kill();
  console.log("CoolStory MCP smoke passed.");
} finally {
  child.kill();
}

async function request(method, params, options = {}) {
  const id = nextId++;
  const wait = new Promise((resolveResponse, rejectResponse) => {
    pending.set(id, { resolve: resolveResponse, reject: rejectResponse, options });
  });
  write({ jsonrpc: "2.0", id, method, params });
  return wait;
}

function notify(method, params) {
  write({ jsonrpc: "2.0", method, params });
}

function write(message) {
  const body = JSON.stringify(message);
  child.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
}

function drainResponses() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return;
    const headers = buffer.subarray(0, headerEnd).toString("utf8");
    const contentLength = parseContentLength(headers);
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;
    if (!Number.isInteger(contentLength) || buffer.length < messageEnd) return;

    const payload = buffer.subarray(messageStart, messageEnd).toString("utf8");
    buffer = buffer.subarray(messageEnd);
    const response = JSON.parse(payload);
    const waiter = pending.get(response.id);
    if (!waiter) continue;
    pending.delete(response.id);
    if (response.error && !waiter.options.expectError) waiter.reject(new Error(response.error.message));
    else waiter.resolve(response.error ? { error: response.error } : response.result);
  }
}

function parseContentLength(headers) {
  for (const line of headers.split("\r\n")) {
    const [name, value] = line.split(":", 2);
    if (name?.toLowerCase() === "content-length") return Number.parseInt(value.trim(), 10);
  }
  return NaN;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
