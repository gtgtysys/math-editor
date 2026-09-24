export const OFFICE_COLORS=[['#C00000','濃い赤'],['#FF0000','赤'],['#FFC000','オレンジ'],['#FFFF00','黄'],['#92D050','薄い緑'],['#00B050','緑'],['#00B0F0','水色'],['#0070C0','青'],['#002060','濃い青'],['#7030A0','紫']];
export const NEUTRALS=[['#000000','黒'],['#FFFFFF','白'],['#404040','濃い灰色'],['#808080','灰色'],['#BFBFBF','薄い灰色']];
export const isMathSymbol=c=>/^[+\-−=<>±∓×÷·*()[\]{}|,;:!∑∏∫∮√∞≤≥≠≈≡∈∉⊂∪∩→←⇒∂∇∀∃…⋯′]$/.test(c);
export function transformSelection(source,start,end,kind){
  const chosen=source.slice(start,end);let text,caret;
  if(kind==='sqrt')text=`\\sqrt{${chosen||'x'}}`;
  else if(kind==='sup'||kind==='sub'){
    // A selection becomes the script itself, just like text formatting in PPT.
    const before=source.slice(0,start),base=before.trim()?'':'{}';
    text=`${base}${kind==='sup'?'^':'_'}{${chosen||(kind==='sup'?'2':'n')}}`;
    if(!chosen)caret=text.length-2;
  }
  else text=kind;
  return {source:source.slice(0,start)+text+source.slice(end),start:caret===undefined?start+text.length:start+caret,end:caret===undefined?start+text.length:start+caret+1};
}
export function insertAfterSelection(source,start,end,text){const at=Math.max(start,end);return {source:source.slice(0,at)+text+source.slice(at),start:at+text.length,end:at+text.length};}
export const encodeProject=p=>'CEOL_FORMULA_V1:'+btoa(unescape(encodeURIComponent(JSON.stringify(p))));
export function decodeProject(text){if(!text.startsWith('CEOL_FORMULA_V1:'))return null;if(text.length>2e6)throw Error('編集データが大きすぎます。');return JSON.parse(decodeURIComponent(escape(atob(text.slice(16)))));}

// Match source characters, then transfer edits by syntax-node identity, never serial ID.
export function remapEdits(oldSource,newSource,oldTree,newTree,edits,range){
  const map=new Map();let prefix=0,suffix=0;
  if(range&&oldSource.slice(0,range.start)===newSource.slice(0,range.start)&&oldSource.slice(range.end)===newSource.slice(newSource.length-(oldSource.length-range.end))){prefix=range.start;suffix=oldSource.length-range.end;}
  else{while(prefix<Math.min(oldSource.length,newSource.length)&&oldSource[prefix]===newSource[prefix])prefix++;while(suffix<Math.min(oldSource.length,newSource.length)-prefix&&oldSource[oldSource.length-1-suffix]===newSource[newSource.length-1-suffix])suffix++;}
  for(let i=0;i<prefix;i++)map.set(i,i);for(let i=0;i<suffix;i++)map.set(oldSource.length-1-i,newSource.length-1-i);
  const a=oldSource.slice(prefix,oldSource.length-suffix),b=newSource.slice(prefix,newSource.length-suffix);
  if(a.length*b.length<=4000000){const cols=b.length+1,dp=new Uint16Array((a.length+1)*cols);for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i*cols+j]=a[i]===b[j]?1+dp[(i+1)*cols+j+1]:Math.max(dp[(i+1)*cols+j],dp[i*cols+j+1]);let i=0,j=0;while(i<a.length&&j<b.length){if(a[i]===b[j]){map.set(prefix+i,prefix+j);i++;j++;}else if(dp[(i+1)*cols+j]>=dp[i*cols+j+1])i++;else j++;}}
  const nodes=tree=>{const out=[];function visit(n){if(!n||typeof n!=='object')return;if(n.id)out.push(n);for(const [key,v]of Object.entries(n))if(key!=='id'&&v&&typeof v==='object'){if(Array.isArray(v))v.forEach(visit);else visit(v);}}visit(tree);return out;};
  const key=(n,start)=>JSON.stringify([n.type,start,n.value??null,n.kind??null]);
  const candidates=new Map(nodes(newTree).filter(n=>Number.isInteger(n.start)).map(n=>[key(n,n.start),n]));const result={};
  for(const n of nodes(oldTree)){if(!edits[n.id]||!map.has(n.start))continue;const next=candidates.get(key(n,map.get(n.start)));if(!next)continue;if(n.type==='char'||n.type==='large'){let intact=true;for(let i=n.start;i<n.end;i++)if(map.get(i)!==next.start+i-n.start){intact=false;break;}if(!intact||next.end-next.start!==n.end-n.start)continue;}result[next.id]={...edits[n.id]};}
  return result;
}
