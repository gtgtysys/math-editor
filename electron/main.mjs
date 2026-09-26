import {app,BrowserWindow,Menu,ipcMain} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startDesktopServer} from '../server-desktop.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
let server,updater,mainWindow;
if(!app.requestSingleInstanceLock())app.quit();
app.setAppUserModelId('jp.gtgtysys.ceol-formula-studio');

async function createWindow(){
  const appRoot=app.getAppPath();
  const portableRoot=process.env.PORTABLE_EXECUTABLE_DIR||path.dirname(process.execPath);
  const scriptRoot=app.isPackaged?path.join(process.resourcesPath,'scripts'):path.join(here,'..','scripts');
  const configPaths=[path.join(portableRoot,'config','api-settings.json')];
  if(!app.isPackaged)configPaths.push(path.join(here,'..','config','api-settings.json'));
  const port=await new Promise((resolve,reject)=>{
    server=startDesktopServer({rootDir:path.join(appRoot,'dist'),clipboardScript:path.join(scriptRoot,'clipboard.ps1'),apiConfigPaths:configPaths,onListening:resolve});
    server.once('error',reject);
  });
  const win=new BrowserWindow({width:1480,height:940,minWidth:980,minHeight:680,show:true,backgroundColor:'#f3f5f3',title:'Ceol Formula Studio',icon:path.join(appRoot,'build','icon.ico'),webPreferences:{preload:path.join(here,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});mainWindow=win;
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(`http://127.0.0.1:${port}/`))event.preventDefault();});
  await win.loadURL(`http://127.0.0.1:${port}/`);
  await setupUpdater(win);
}

function sendUpdate(status,data={}){if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('ceol:update-status',{status,...data});}
async function setupUpdater(win){
  if(!app.isPackaged)return;
  try{
    const module=await import('electron-updater');updater=module.autoUpdater||module.default?.autoUpdater;
    if(!updater)throw Error('更新機能を開始できません。');
    updater.autoDownload=true;updater.autoInstallOnAppQuit=true;
    updater.on('checking-for-update',()=>sendUpdate('checking'));
    updater.on('update-available',info=>sendUpdate('available',{version:info.version}));
    updater.on('update-not-available',()=>sendUpdate('current',{version:app.getVersion()}));
    updater.on('download-progress',progress=>sendUpdate('downloading',{percent:Math.round(progress.percent||0)}));
    updater.on('update-downloaded',info=>sendUpdate('ready',{version:info.version}));
    updater.on('error',error=>sendUpdate('error',{message:error?.message||'更新を確認できませんでした。'}));
    setTimeout(()=>updater.checkForUpdates().catch(error=>sendUpdate('error',{message:error.message})),2500);
  }catch(error){sendUpdate('error',{message:error.message});}
}
ipcMain.handle('ceol:update-check',async()=>{if(!updater)return {available:false,message:'インストール版で利用できます。'};await updater.checkForUpdates();return {available:true};});
ipcMain.on('ceol:update-install',()=>updater?.quitAndInstall(false,true));

app.whenReady().then(createWindow).catch(error=>{console.error(error);app.quit();});
app.on('second-instance',()=>{const win=BrowserWindow.getAllWindows()[0];if(win){if(win.isMinimized())win.restore();win.focus();}});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>server?.close());
