import {spawn} from 'node:child_process';
import {startServer} from '../server-native.mjs';
const url='http://127.0.0.1:4173';
function open(){if(process.platform==='win32')spawn('cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'}).unref();}
let running=false;
try{const response=await fetch(url+'/api/capabilities',{signal:AbortSignal.timeout(1000)});running=(await response.json()).app==='ceol-formula-studio';}catch{}
if(running){console.log('Editor is already running: '+url);open();}else{
  const server=startServer();server.on('listening',open);server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 4173 is already in use. Close the previous editor/server and try again.':error.message);process.exitCode=1;});
}
