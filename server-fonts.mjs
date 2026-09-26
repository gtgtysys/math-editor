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
export function extractTtcFaces(buffer){
  if(buffer.toString('ascii',0,4)!=='ttcf')return [buffer];
  const count=buffer.readUInt32BE(8),faces=[];
  if(!count||count>64||12+count*4>buffer.length)throw Error('壊れたTTCファイルです。');
  for(let faceIndex=0;faceIndex<count;faceIndex++){
    const faceOffset=buffer.readUInt32BE(12+faceIndex*4);
    if(faceOffset+12>buffer.length)continue;
    const tableCount=buffer.readUInt16BE(faceOffset+4),directorySize=12+tableCount*16;
    if(!tableCount||faceOffset+directorySize>buffer.length)continue;
    const tables=[];let outputSize=directorySize;
    for(let i=0;i<tableCount;i++){
      const record=faceOffset+12+i*16,offset=buffer.readUInt32BE(record+8),length=buffer.readUInt32BE(record+12);
      if(offset+length>buffer.length)throw Error('壊れたTTCテーブルです。');
      tables.push({record,offset,length,outputOffset:outputSize});outputSize+=(length+3)&~3;
    }
    const face=Buffer.alloc(outputSize);buffer.copy(face,0,faceOffset,faceOffset+12);
    for(let i=0;i<tables.length;i++){
      const table=tables[i],record=12+i*16;
      buffer.copy(face,record,table.record,table.record+8);
      face.writeUInt32BE(table.outputOffset,record+8);face.writeUInt32BE(table.length,record+12);
      buffer.copy(face,table.outputOffset,table.offset,table.offset+table.length);
    }
    faces.push(face);
  }
  if(!faces.length)throw Error('TTCに利用できる書体がありません。');
  return faces;
}
export async function scanFonts(directories){
  const catalog=new Map();
  for(const directory of directories){let files;try{files=await readdir(directory);}catch{continue;}
    for(const file of files){if(!/\.(ttf|otf|ttc)$/i.test(file))continue;const full=path.join(directory,file);try{const info=await stat(full);if(!info.isFile()||info.size>40e6)continue;const source=await readFile(full),faces=source.toString('ascii',0,4)==='ttcf'?extractTtcFaces(source):[source];for(let faceIndex=0;faceIndex<faces.length;faceIndex++){const bytes=faces[faceIndex];if(!['OTTO','true'].includes(bytes.toString('ascii',0,4))&&bytes.readUInt32BE(0)!==0x10000)continue;const label=fontName(bytes,path.parse(file).name),normalized=label.normalize('NFKC').toLowerCase().replace(/[\s_-]/g,'');let id='system:'+createHash('sha256').update(label.toLowerCase()).digest('hex').slice(0,24);
      if(normalized==='timesnewroman'||file.toLowerCase()==='times.ttf')id='times';
      if(['euclid','euclidregular'].includes(normalized))id='euclid';
      if(['euclidsymbol','euclidsymbolregular'].includes(normalized))id='euclid-symbol';
      if(normalized==='euclidsymbolbold')id='euclid-symbol-bold';
      if(normalized==='ceolitalic')id='ceol-italic';if(['ceol','ceolregular'].includes(normalized))id='ceol';if(normalized==='ceolbold')id='ceol-bold';if(/kozminpro.*regular/i.test(normalized))id='fallback';
      if(!catalog.has(id))catalog.set(id,{id,label,path:full,faceIndex:faces.length>1?faceIndex:undefined});}
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
export async function readInstalledFont(id){const entry=(await installedFonts()).get(id);if(!entry)throw Error('このフォントはPCにありません。TTF／OTF／TTCを追加してください。');const bytes=await readFile(entry.path);return entry.faceIndex===undefined?bytes:extractTtcFaces(bytes)[entry.faceIndex];}
