const { contextBridge, ipcRenderer, shell } = require('electron');
// const path = require('path');
// const { initSendMsg } = require(path.join(__dirname, 'utils.js'))

window.addEventListener('DOMContentLoaded', () => {
    console.log('Preload script loaded');
});

contextBridge.exposeInMainWorld('utils', {
    fetchData: () => ipcRenderer.invoke('fetchData'),
    registerLog: (callback) => {
        // console.log('registering log callback');
        ipcRenderer.on('logMessage', (event, msg) => {
            // console.log(msg);
            callback(msg);
        });
    },
    getCurrentData: () => ipcRenderer.invoke('getCurrentData'),
    getFolder: () => ipcRenderer.invoke('getFolder'),
    getConfig: () => ipcRenderer.invoke('getConfig'),
    downloadImage: (url) => ipcRenderer.invoke('downloadImage', url),
    getGachaType: () => ipcRenderer.invoke('getGachaType'),
    setGame: (game) => ipcRenderer.invoke('setGame', game),
    loadIconJson: () => ipcRenderer.invoke('loadIconJson'),
    exportData: (data) => ipcRenderer.invoke('exportData'),
    importData: (data) => ipcRenderer.invoke('importData'),
    getUids: () => ipcRenderer.invoke('getUids'),
    changeCurrent: (current) => ipcRenderer.invoke('changeCurrent', current),
    openExternal: (url) => ipcRenderer.invoke('openUrl', url),
    getScreenshotFiles: () => ipcRenderer.invoke('getScreenshotFiles'),
})