#!/usr/bin/env node
process.env.COOLSTORY_PLUGIN_LIBRARY = "1";

const { startDesktopServer } = await import("../../src/index.js");

const { server, url } = await startDesktopServer();
try {
  const html = await fetchText("/");
  expect(html.includes("toggleLeft"), "left rail collapse control missing");
  expect(html.includes("toggleRight"), "right rail collapse control missing");
  expect(html.includes("artifactTypeNav"), "artifact type navigation missing");
  expect(html.includes("sidebarArtifactNav"), "artifact navigation missing");
  expect(html.includes("Open browser sign-in"), "device auth browser sign-in action missing");

  const status = await fetchJson("/api/status");
  expect(status.ok === true, "status endpoint did not return ok");
  console.log(`desktop status authenticated=${Boolean(status.authenticated)}`);

  if (process.env.COOLSTORY_TOKEN) {
    expect(status.authenticated === true, "COOLSTORY_TOKEN is set but desktop status is not authenticated");
    const repos = await fetchJson("/api/repos");
    expect(Array.isArray(repos.repos), "repos response missing repos array");
    console.log(`desktop repos=${repos.repos.length}`);
    if (repos.repos[0]) {
      expect(Array.isArray(repos.repos[0].members), "repo response missing members array");
      const prds = await fetchJson(`/api/prds?repo=${encodeURIComponent(repos.repos[0].slug)}`);
      expect(Array.isArray(prds.prds), "artifact response missing prds array");
      if (prds.prds[0]) expect("kind" in prds.prds[0], "artifact response missing kind");
      console.log(`desktop first_repo=${repos.repos[0].slug} artifacts=${prds.prds.length}`);
    }
  }

  console.log("CoolStory desktop smoke checks passed.");
} finally {
  server.close();
}

async function fetchText(path) {
  const response = await fetch(new URL(path, url));
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  return response.text();
}

async function fetchJson(path) {
  const text = await fetchText(path);
  return JSON.parse(text);
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}
