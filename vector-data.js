// A zero-area, unstroked path carries editing data through Office's SVG rewrite.
// Metadata elements and custom attributes are discarded by PowerPoint.
export function vectorDataPath(project){
  const bytes=new TextEncoder().encode('CEOL_VECTOR_V1:'+JSON.stringify(project));
  if(bytes.length>200000)throw Error('編集情報が大きすぎます。JSON形式で保存してください。');
  return 'M0 0 '+Array.from(bytes,b=>`L${(b+1)/1024} 0 L0 0`).join(' ')+' Z';
}
export function projectFromVectorPath(path){
  if(typeof path!=='string'||path.length>8000000||/[^MLZmlz\d\s.,eE+\-]/.test(path))return null;
  const tokens=path.match(/[MLZmlz]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)||[];
  const bytes=[];let i=0,command='';
  while(i<tokens.length){if(/^[MLZmlz]$/.test(tokens[i])){command=tokens[i++];if(command==='Z'||command==='z')continue;}
    if(!['M','L'].includes(command)||i+1>=tokens.length)return null;
    const x=Number(tokens[i++]),y=Number(tokens[i++]);if(!Number.isFinite(x)||y!==0)return null;
    if(x===0)continue;const n=Math.round(x*1024);if(n<1||n>256||Math.abs(x*1024-n)>.002)return null;bytes.push(n-1);
  }
  const text=new TextDecoder().decode(new Uint8Array(bytes));if(!text.startsWith('CEOL_VECTOR_V1:'))return null;
  try{return JSON.parse(text.slice(15));}catch{return null;}
}
