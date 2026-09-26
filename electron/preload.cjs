const {contextBridge,ipcRenderer}=require('electron');

contextBridge.exposeInMainWorld('ceolUpdater',{
  check:()=>ipcRenderer.invoke('ceol:update-check'),
  install:()=>ipcRenderer.send('ceol:update-install'),
  onStatus:callback=>ipcRenderer.on('ceol:update-status',(_event,status)=>callback(status))
});
