const { app, BrowserWindow, shell } = require("electron");
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
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  server?.close();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
