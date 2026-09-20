const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const { spawn, exec } = require("child_process");
const path = require("path");
const net = require("net");
const http = require("http");

const APP_NAME = "InnLedger";

let win = null;
let server = null;
let port = 0;
let lastStatus = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

/* ---------- backend ---------- */
function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = s.address().port;
      s.close(() => resolve(p));
    });
    s.on("error", reject);
  });
}

function startBackend() {
  // Database and uploaded IDs live in the user data folder, so app updates never touch them.
  const env = { ...process.env, INN_PORT: String(port), INN_DATA_DIR: app.getPath("userData") };
  if (app.isPackaged) {
    const exe = path.join(process.resourcesPath, "server", "innledger-server.exe");
    server = spawn(exe, [], { env, windowsHide: true });
  } else {
    const root = path.join(__dirname, "..", "backend");
    const py = path.join(root, ".venv", "Scripts", "python.exe");
    server = spawn(py, ["run_desktop.py"], { cwd: root, env, windowsHide: true });
  }
  server.on("error", (e) => dialog.showErrorBox(APP_NAME, "Could not start the local server:\n" + e.message));
}

function stopBackend() {
  if (server && server.pid) {
    // PyInstaller one-file exes spawn a child, so kill the whole tree.
    exec(`taskkill /pid ${server.pid} /T /F`);
    server = null;
  }
}

function waitForBackend(timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const retry = () =>
      Date.now() - start > timeoutMs ? reject(new Error("Server did not start in time")) : setTimeout(tick, 300);
    const tick = () => {
      http
        .get({ host: "127.0.0.1", port, path: "/api/health", timeout: 1000 }, (res) => {
          res.resume();
          res.statusCode === 200 ? resolve() : retry();
        })
        .on("error", retry);
    };
    tick();
  });
}

/* ---------- window ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 620,
    title: APP_NAME,
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: true,
    backgroundColor: "#f8fafc",
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.once("ready-to-show", () => win.show());
  // PDFs open in a new window; anything external goes to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("blob:")) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: { autoHideMenuBar: true, width: 1000, height: 900, title: APP_NAME },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.loadURL(`http://127.0.0.1:${port}`);
  win.on("closed", () => (win = null));
}

/* ---------- auto update (GitHub Releases) ---------- */
function send(status) {
  lastStatus = status;
  if (win && !win.isDestroyed()) win.webContents.send("update:status", status);
}

function setupUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => send({ state: "checking" }));
  autoUpdater.on("update-available", (i) => send({ state: "available", version: i.version }));
  autoUpdater.on("update-not-available", () => send({ state: "none" }));
  autoUpdater.on("download-progress", (p) => send({ state: "downloading", percent: Math.round(p.percent) }));
  autoUpdater.on("update-downloaded", (i) => send({ state: "ready", version: i.version }));
  autoUpdater.on("error", (e) => send({ state: "error", message: String(e && e.message ? e.message : e) }));

  ipcMain.handle("update:check", () =>
    app.isPackaged ? autoUpdater.checkForUpdates().catch(() => {}) : send({ state: "dev" })
  );
  ipcMain.handle("update:download", () => autoUpdater.downloadUpdate().catch(() => {}));
  ipcMain.handle("update:install", () => autoUpdater.quitAndInstall(true, true));
  ipcMain.handle("update:last", () => lastStatus);

  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
  }
}

ipcMain.handle("app:version", () => app.getVersion());

app.whenReady().then(async () => {
  setupUpdater();
  try {
    port = await freePort();
    startBackend();
    await waitForBackend();
    createWindow();
  } catch (e) {
    dialog.showErrorBox(APP_NAME, "Could not start: " + e.message);
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", stopBackend);
process.on("exit", stopBackend);
