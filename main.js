const { app, BrowserWindow, dialog } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");

let mainWindow = null;

// アプリの画面を作る
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "frontend", "index.html"));
}

// 新しいバージョンがあれば自動で確認する
function setupAutoUpdate() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.on("error", function (error) {
    console.log("update error:", error.message);
  });

  autoUpdater.on("update-downloaded", function () {
    dialog.showMessageBox(mainWindow, {
      type: "info",
      buttons: ["再起動して更新", "あとで"],
      defaultId: 0,
      cancelId: 1,
      title: "更新の準備ができました",
      message: "新しいバージョンをインストールできます。"
    }).then(function (result) {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.checkForUpdates();
}

// Electronの準備ができたら画面を開く
app.whenReady().then(function () {
  createWindow();
  setupAutoUpdate();
});

// Windowsでは、画面を閉じたらアプリを終了する
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// macOS用の処理
app.on("activate", function () {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
