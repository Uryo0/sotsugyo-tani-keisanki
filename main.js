const { app, BrowserWindow } = require("electron");
const path = require("path");

// アプリの画面を作る
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, "frontend", "index.html"));
}

// Electronの準備ができたら画面を開く
app.whenReady().then(createWindow);

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