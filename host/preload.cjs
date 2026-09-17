const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nocturnaHost', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  quit: () => ipcRenderer.invoke('quit-host'),
  onStatus: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('server-status', handler);
    return () => ipcRenderer.removeListener('server-status', handler);
  },
  onLog: (cb) => {
    const handler = (_e, line) => cb(line);
    ipcRenderer.on('server-log', handler);
    return () => ipcRenderer.removeListener('server-log', handler);
  },
});
