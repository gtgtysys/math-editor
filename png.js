const encoder=new TextEncoder(),decoder=new TextDecoder();
const signature=[137,80,78,71,13,10,26,10];
export function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function concat(parts){const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){result.set(p,i);i+=p.length;}return result;}
function chunk(type,data){const body=concat([encoder.encode(type),data]),out=new Uint8Array(data.length+12),view=new DataView(out.buffer);view.setUint32(0,data.length);out.set(body,4);view.setUint32(out.length-4,crc32(body));return out;}
export function chunks(bytes){
  if(bytes.length<20||!signature.every((b,i)=>b===bytes[i]))throw Error('PNGファイルではありません。');
  const result=[];let i=8,ended=false;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  while(i+12<=bytes.length){const len=view.getUint32(i);if(len>bytes.length-i-12)throw Error('PNGが破損しています。');const type=decoder.decode(bytes.slice(i+4,i+8)),data=bytes.slice(i+8,i+8+len);if(crc32(bytes.slice(i+4,i+8+len))!==view.getUint32(i+8+len))throw Error('PNGの整合性を確認できません。');result.push({type,data,raw:bytes.slice(i,i+len+12)});i+=len+12;if(type==='IEND'){ended=true;break;}}
  if(!ended)throw Error('PNGの終端がありません。');return result;
}
export function embedPNG(bytes,project,scale){
  const data=encoder.encode(JSON.stringify(project)),meta=concat([encoder.encode('ceol-formula'),new Uint8Array([0,0,0,0,0]),data]),phys=new Uint8Array(9),view=new DataView(phys.buffer);view.setUint32(0,Math.round(96*scale/0.0254));view.setUint32(4,Math.round(96*scale/0.0254));phys[8]=1;
  const parts=[new Uint8Array(signature)];for(const c of chunks(bytes)){if(c.type==='pHYs'||c.type==='iTXt'&&decoder.decode(c.data).startsWith('ceol-formula\0'))continue;if(c.type==='IDAT'&&!parts.some(p=>p===phys)){/* pHYs is inserted after IHDR below */}parts.push(c.raw);if(c.type==='IHDR')parts.push(chunk('pHYs',phys),chunk('iTXt',meta));}return concat(parts);
}
export function extractPNG(bytes){for(const c of chunks(bytes)){if(c.type!=='iTXt')continue;const keyEnd=c.data.indexOf(0);if(decoder.decode(c.data.slice(0,keyEnd))!=='ceol-formula')continue;if(c.data[keyEnd+1]!==0)throw Error('圧縮された編集データは未対応です。');let p=keyEnd+3;for(let k=0;k<2;k++){p=c.data.indexOf(0,p)+1;if(!p)throw Error('編集データが破損しています。');}return JSON.parse(decoder.decode(c.data.slice(p)));}return null;}
