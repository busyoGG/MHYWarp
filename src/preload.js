const { contextBridge, ipcRenderer } = require('electron');
// const path = require('path');
// const { initSendMsg } = require(path.join(__dirname, 'utils.js'))

window.addEventListener('DOMContentLoaded', () => {
    console.log('Preload script loaded');
});

contextBridge.exposeInMainWorld('utils', {
    fetchData: () => ipcRenderer.invoke('fetchData'),
    registerLog: () => {
        ipcRenderer.on('log-message', (event, msg) => {
            console.log(msg);
        });
    },
    getCurrentData: () => ipcRenderer.invoke('getCurrentData'),
    getFolder: () => ipcRenderer.invoke('getFolder'),
    getConfig: () => ipcRenderer.invoke('getConfig'),
    downloadImage: (url) => ipcRenderer.invoke('downloadImage', url)
})