import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {validateProject} from './dist/engine.js';
import {interpret} from './dist/providers.js';
import {installedFonts,readInstalledFont} from './server-fonts.mjs';
import {loadApiSettings,validateApiSettings} from './server-config.mjs';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.ttf':'font/ttf','.otf':'font/otf','.svg':'image/svg+xml','.json':'application/json'};
const native=process.platform==='win32';let busy=false;
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
async function body(req,limit=32e6){const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>limit)throw Error('送信データが大きすぎます。');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}

export function validateCopy(c){
  const finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
  if(!c||!finite(c.width,1,16000)||!finite(c.height,1,16000)||!finite(c.scale,.1,3)||c.width*c.height*c.scale*c.scale>32e6||!finite(c.offsetX,-20000,20000)||!finite(c.offsetY,-20000,20000)||!finite(c.boldWidth,0,10))throw Error('画像サイズが不正です。');
  if(typeof c.project!=='string'||c.project.length>1e6)throw Error('編集データが不正です。');validateProject(JSON.parse(c.project));
  if(typeof c.svg!=='string'||c.svg.length>12e6||typeof c.png!=='string'||c.png.length>16e6||!/^[a-zA-Z0-9+/=]+$/.test(c.png)||!/^#[a-f0-9]{6}$/i.test(c.background)||typeof c.transparent!=='boolean')throw Error('画像データが不正です。');
  if(!Array.isArray(c.items)||c.items.length>6000)throw Error('数式が大きすぎます。');
  for(const g of c.items){if(!['line','glyph','stroke'].includes(g.type)||!finite(g.x,-20000,20000)||!finite(g.y,-20000,20000)||!/^#[a-f0-9]{6}$/i.test(g.color))throw Error('字形が不正です。');if(g.type==='line'){if(!finite(g.w,0,16000)||!finite(g.h,0,100))throw Error('線が不正です。');}else if(typeof g.path!=='string'||g.path.length>500000||!/^[MLCQHVZ\d\s.,eE+\-]*$/.test(g.path)||g.type==='stroke'&&!finite(g.strokeWidth,.01,100))throw Error('字形パスが不正です。');}
  return c;
}

export function startDesktopServer(options){
  const root=path.resolve(options.rootDir),clipboardScript=options.clipboardScript,apiConfigPaths=options.apiConfigPaths||[];
  const bridge=(mode,payload)=>new Promise((resolve,reject)=>{const child=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',clipboardScript,'-Mode',mode],{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{child.kill();reject(Error('クリップボード処理がタイムアウトしました。'));},25000);child.stdout.on('data',b=>{out+=b;if(out.length>35e6)child.kill();});child.stderr.on('data',b=>{err+=b;});child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error(err.trim().slice(-500)||'Windowsのクリップボードに接続できません。'));try{resolve(JSON.parse(out));}catch{reject(Error('クリップボードの応答を読み取れません。'));}});child.stdin.on('error',()=>{});child.stdin.end(payload);});
  const server=http.createServer(async(req,res)=>{try{
    const port=server.address()?.port,hosts=[`127.0.0.1:${port}`,`localhost:${port}`],origins=hosts.map(h=>`http://${h}`);
    if(!hosts.includes(req.headers.host)){json(res,403,{error:'Host not allowed'});return;}
    const url=new URL(req.url,origins[0]);
    if(url.pathname==='/api/capabilities'){
      let configured=null,configError=null;try{configured=await loadApiSettings(apiConfigPaths);}catch(e){configError=e.message;}
      json(res,200,{app:'ceol-formula-studio',nativeClipboard:native,apiSettings:configured?{provider:configured.provider,model:configured.model}:null,configError});return;
    }
    if(url.pathname==='/api/fonts'||url.pathname.startsWith('/api/font/')){
      if(req.method!=='GET'||req.headers['x-ceol-request']!=='1'||req.headers['sec-fetch-site']==='cross-site'){json(res,403,{error:'エディタ画面から操作してください。'});return;}
      if(url.pathname==='/api/fonts'){const catalog=await installedFonts();json(res,200,{fonts:[...catalog.values()].map(({id,label})=>({id,label})).sort((a,b)=>a.label.localeCompare(b.label))});return;}
      const content=await readInstalledFont(decodeURIComponent(url.pathname.slice('/api/font/'.length)));res.writeHead(200,{'Content-Type':'font/ttf','Cache-Control':'no-store'});res.end(content);return;
    }
    if(url.pathname==='/api/ai'){
      if(req.method!=='POST'||!origins.includes(req.headers.origin)||req.headers['x-ceol-request']!=='1'||!req.headers['content-type']?.startsWith('application/json')){json(res,403,{error:'同じアプリ画面から操作してください。'});return;}
      const request=await body(req,22e6);if(typeof request.prompt!=='string'||request.prompt.length>12000||request.image!==null&&request.image!==undefined&&(typeof request.image!=='string'||request.image.length>20e6))throw Error('AI入力が不正です。');
      const settings=request.settings?validateApiSettings(request.settings):await loadApiSettings(apiConfigPaths);if(!settings)throw Error('config/api-settings.jsonにAPI設定を記入するか、AI設定画面で設定してください。');
      json(res,200,{source:await interpret(settings,request.prompt,request.image||null)});return;
    }
    if(url.pathname.startsWith('/api/clipboard/')){
      if(!native){json(res,404,{error:'Windowsデスクトップ版専用です。'});return;}
      if(req.method!=='POST'||!origins.includes(req.headers.origin)||req.headers['x-ceol-request']!=='1'||!req.headers['content-type']?.startsWith('application/json')){json(res,403,{error:'同じアプリ画面から操作してください。'});return;}
      if(busy){json(res,429,{error:'前のコピー・貼り付け処理が終わるまでお待ちください。'});return;}
      const mode=url.pathname.split('/').at(-1);if(!['copy','paste'].includes(mode)){json(res,404,{error:'Not found'});return;}
      const request=await body(req);if(mode==='copy')validateCopy(request);busy=true;try{json(res,200,await bridge(mode,JSON.stringify(request)));}finally{busy=false;}return;
    }
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(path.relative(root,file).startsWith('..')||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end();return;}
    const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
  }catch(e){json(res,400,{error:e.message||'処理に失敗しました。'});}});
  return server.listen(0,'127.0.0.1',()=>options.onListening(server.address().port));
}
