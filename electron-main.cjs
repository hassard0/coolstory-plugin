const { app, BrowserWindow, shell } = require("electron");
const fs = require("node:fs/promises");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

process.env.COOLSTORY_PLUGIN_LIBRARY = "1";

let server;
let mainWindow;

async function createWindow() {
  const moduleUrl = pathToFileURL(path.join(__dirname, "src", "index.js")).href;
  const desktop = await import(moduleUrl);
  const started = await desktop.startDesktopServer();
  server = started.server;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: "CoolStory Desktop",
    backgroundColor: "#0a1216",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  await mainWindow.loadURL(started.url);
  if (process.env.COOLSTORY_DESKTOP_SMOKE === "1") {
    await runPackagedSmoke(started.url);
  }
}

async function runPackagedSmoke(url) {
  try {
    const checks = await mainWindow.webContents.executeJavaScript(`
      (() => {
        const ids = [
          "toggleLeft",
          "toggleRight",
          "leftResize",
          "rightResize",
          "artifactTypeNav",
          "sidebarArtifactNav",
          "projectList",
          "profileAvatars",
          "artifactEditor",
          "connectBtn"
        ];
        return {
          readyState: document.readyState,
          title: document.title,
          bodyText: document.body.innerText,
          ids: Object.fromEntries(ids.map((id) => [id, Boolean(document.getElementById(id))])),
          appClasses: document.querySelector(".app")?.className || null
        };
      })()
    `);
    const bounds = mainWindow.getBounds();
    const missingIds = Object.entries(checks.ids).filter(([, exists]) => !exists).map(([id]) => id);
    const bodyText = checks.bodyText.toLowerCase();
    const failures = [];
    if (mainWindow.getTitle() !== "CoolStory Desktop") failures.push("window title mismatch");
    if (!url.startsWith("http://127.0.0.1:")) failures.push("desktop did not load local server URL");
    if (bounds.width < 1100 || bounds.height < 720) failures.push("window opened below minimum landscape size");
    if (bounds.width <= bounds.height) failures.push("window did not open in landscape orientation");
    if (missingIds.length) failures.push(`missing DOM ids: ${missingIds.join(", ")}`);
    if (!bodyText.includes("open browser sign-in")) failures.push("device auth action is missing");
    if (!bodyText.includes("projects")) failures.push("project navigation is missing");
    if (!bodyText.includes("artifact types")) failures.push("artifact type navigation is missing");

    const result = {
      ok: failures.length === 0,
      failures,
      title: mainWindow.getTitle(),
      url,
      bounds,
      dom: checks,
    };
    if (process.env.COOLSTORY_DESKTOP_SMOKE_OUT) {
      await fs.writeFile(process.env.COOLSTORY_DESKTOP_SMOKE_OUT, JSON.stringify(result, null, 2));
    }
    server?.close();
    app.exit(result.ok ? 0 : 1);
  } catch (error) {
    if (process.env.COOLSTORY_DESKTOP_SMOKE_OUT) {
      await fs.writeFile(process.env.COOLSTORY_DESKTOP_SMOKE_OUT, JSON.stringify({ ok: false, error: error.message }, null, 2));
    }
    server?.close();
    app.exit(1);
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  server?.close();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
