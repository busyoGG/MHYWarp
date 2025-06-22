const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { fetchData, getCurrentData, openFolderSelector, exportData, importData, getAllUids, setBg, setBlur } = require('./utils.js');
const { loadIconJson, downloadImage } = require('./getIcon.js');
const { getGachaType } = require('./getGacha.js');
const { setGame, getConfig, changeCurrent, iconJsonData } = require('./config.js');
const { getScreenshotFiles, generateThumbnail, copyScreenshot } = require('./screenshotUtils.js');

// 开发模式启用 electron-reload
if (process.env.NODE_ENV === 'development') {
    try {
        // console.log(`${__dirname}/../node_modules/electron`)
        require('electron-reload')(__dirname, {
            electron: require(`${__dirname}/../node_modules/electron`)
        });
        console.log('Electron reload enabled');
    } catch (e) {
        console.warn('electron-reload not found or failed to load.');
    }
} else {
    Menu.setApplicationMenu(null);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'), // 这样才能让preload.js运行在有Node权限的环境
            contextIsolation: true,
            nodeIntegration: false
        },
        icon: path.join(__dirname, '../res/icon.png')
    });
    win.loadFile('src/index.html');
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('fetchData', async () => {
    return await fetchData()
})

ipcMain.handle('getCurrentData', async () => {
    return await getCurrentData()
})

ipcMain.handle('getFolder', async () => {
    return await openFolderSelector()
})

ipcMain.handle('getConfig', async () => {
    return await getConfig()
})

ipcMain.handle('downloadImage', async (evt, url) => {
    let res = await downloadImage(url);
    // console.log("url ==>", url,res)
    return res
})

ipcMain.handle('getGachaType', async (evt) => {
    return await getGachaType()
})

ipcMain.handle('setGame', async (evt, game) => {
    console.log("setGame ==>", game)
    return await setGame(game)
})

ipcMain.handle('loadIconJson', async (evt) => {
    return await loadIconJson()
})

ipcMain.handle("exportData", async (evt) => {
    await exportData()
});

ipcMain.handle("importData", async (evt) => {
    return await importData();
})

ipcMain.handle("getUids", async (evt) => {
    return getAllUids()
})

ipcMain.handle("changeCurrent", async (evt, uid) => {
    await changeCurrent(uid)
})

ipcMain.handle("openUrl", async (evt, url) => {
    shell.openExternal(url)
})

ipcMain.handle("getScreenshotFiles", async (evt) => {
    return await getScreenshotFiles();
})

ipcMain.handle("generateThumbnail", async (evt, imagePath, width) => {
    return await generateThumbnail(imagePath, width)
});

ipcMain.handle("copyScreenshot", async (evt, src) => {
    copyScreenshot(src);
});

ipcMain.handle("setBg", async (evt,clear) => {
    return await setBg(clear);
})

ipcMain.handle("setBlur", async (evt, blur) => { 
    setBlur(blur);
})
