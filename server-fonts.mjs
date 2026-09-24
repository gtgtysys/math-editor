import {readdir,readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

// Read only font name tables here; font bytes never leave the local server.
export function fontName(buffer,fallback){
  try{
    const count=buffer.readUInt16BE(4);let offset;
    for(let i=0;i<count;i++){const p=12+i*16;if(buffer.toString('ascii',p,p+4)==='name'){offset=buffer.readUInt32BE(p+8);break;}}
    if(offset===undefined)return fallback;
    const names=[],records=buffer.readUInt16BE(offset+2),strings=offset+buffer.readUInt16BE(offset+4);
    for(let i=0;i<records;i++){const p=offset+6+i*12,platform=buffer.readUInt16BE(p),language=buffer.readUInt16BE(p+4),id=buffer.readUInt16BE(p+6);if(id!==4)continue;const length=buffer.readUInt16BE(p+8),start=strings+buffer.readUInt16BE(p+10);if(start+length>buffer.length)continue;let value;if(platform===0||platform===3){const bytes=Buffer.from(buffer.subarray(start,start+length));if(bytes.length%2)continue;value=bytes.swap16().toString('utf16le');}else if(platform===1)value=buffer.toString('latin1',start,start+length);if(value)names.push({value,score:language===0x409?3:platform===3?2:1});}
    return names.sort((a,b)=>b.score-a.score)[0]?.value.replace(/[\x00-\x1f]/g,'')||fallback;
  }catch{return fallback;}
}
export async function scanFonts(directories){
  const catalog=new Map();
  for(const directory of directories){let files;try{files=await readdir(directory);}catch{continue;}
    for(const file of files){if(!/\.(ttf|otf)$/i.test(file))continue;const full=path.join(directory,file);try{const info=await stat(full);if(!info.isFile()||info.size>25e6)continue;const bytes=await readFile(full);if(!['OTTO','true'].includes(bytes.toString('ascii',0,4))&&bytes.readUInt32BE(0)!==0x10000)continue;const label=fontName(bytes,path.parse(file).name),normalized=label.toLowerCase().replace(/[\s_-]/g,'');let id='system:'+createHash('sha256').update(label.toLowerCase()).digest('hex').slice(0,24);
      if(normalized==='timesnewroman'||file.toLowerCase()==='times.ttf')id='times';
      if(['euclid','euclidregular'].includes(normalized))id='euclid';
      if(['euclidsymbol','euclidsymbolregular'].includes(normalized))id='euclid-symbol';
      if(normalized==='euclidsymbolbold')id='euclid-symbol-bold';
      if(normalized==='ceolitalic')id='ceol-italic';if(['ceol','ceolregular'].includes(normalized))id='ceol';if(normalized==='ceolbold')id='ceol-bold';if(/kozminpro.*regular/i.test(normalized))id='fallback';
      if(!catalog.has(id))catalog.set(id,{id,label,path:full});
    }catch{/* An unreadable font does not prevent startup. */}}
  }
  return catalog;
}
let cached;
export function installedFonts(){return cached??=scanFonts([
  path.join(process.env.WINDIR||'C:/Windows','Fonts'),
  ...(process.env.LOCALAPPDATA?[path.join(process.env.LOCALAPPDATA,'Microsoft','Windows','Fonts')]:[]),
  fileURLToPath(new URL('./dist/fonts/',import.meta.url)),
]);}
export async function readInstalledFont(id){const entry=(await installedFonts()).get(id);if(!entry)throw Error('このフォントはPCにありません。TTF／OTFを追加してください。');return readFile(entry.path);}
