const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { fetchData, getCurrentData, openFolderSelector, getConfig } = require('./utils.js');
const { downloadImage } = require('./getIcon.js');

// 开发模式启用 electron-reload
if (process.env.NODE_ENV === 'development') {
    try {
        require('electron-reload')(__dirname, {
            electron: require(`${__dirname}/node_modules/electron`)
        });
        Menu.setApplicationMenu(null);
        console.log('Electron reload enabled');
    } catch (e) {
        console.warn('electron-reload not found or failed to load.');
    }
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
    return await downloadImage(res)
})