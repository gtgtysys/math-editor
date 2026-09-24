import {mapNamedSymbols} from './font-symbols.js';
import {vectorDataPath,projectFromVectorPath} from './vector-data.js';
import {parse,layout,validateProject} from './engine.js';
import {embedPNG,extractPNG} from './png.js';
import {interpret} from './providers.js';
import {remapEdits,OFFICE_COLORS,NEUTRALS,isMathSymbol,insertAfterSelection,transformSelection,encodeProject,decodeProject} from './editing.js';
const $=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
const fonts=new Map(),fontCatalog=new Map(),fontLoads=new Map();
async function ensureFont(id){if(fonts.has(id))return;if(!fontCatalog.has(id))throw Error(`フォント「${id}」をPCにインストールするか、TTF／OTFを追加してください。`);if(!fontLoads.has(id))fontLoads.set(id,(async()=>{const r=await fetch('/api/font/'+encodeURIComponent(id),{headers:{'X-Ceol-Request':'1'}});if(!r.ok)throw Error('フォントを読み込めませんでした。');fonts.set(id,mapNamedSymbols(opentype.parse(await r.arrayBuffer())));})().finally(()=>fontLoads.delete(id)));return fontLoads.get(id);}
function fontOptions(){return [...fontCatalog.values(),...[...fonts].filter(([id])=>!fontCatalog.has(id)).map(([id,font])=>({id,label:font.names.fullName?.en||id}))];}
let state={app:'ceol-formula-studio',version:1,layoutVersion:2,symbolFont:'euclid',exportScale:1/3,bold:false,source:$('source').value,font:'ceol-italic',fontSize:28,color:'#000000',transparent:true,background:'#ffffff',padding:12,edits:{}};
let editAnchor=null,inputRange=null;
let rendered=null,selected=null,zoom=1,history=[],future=[],drag=null,attachedImage=null,settings={provider:'gemini',model:'',key:''},invalid=false;
const selection=new Set();let selectionAnchor=null,nativeClipboard=false;
const clone=v=>structuredClone(v);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),5000);}
function checkpoint(){history.push(clone(state));if(history.length>80)history.shift();future=[];updateHistory();}
function updateHistory(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;}
function clearSelection(){selected=null;selection.clear();selectionAnchor=null;}
function setState(next){checkpoint();state=clone(next);clearSelection();syncControls();render();}
function setColor(id,color){const el=$(id);if(!Array.from(el.options).some(o=>o.value===color))el.add(new Option(color,color));el.value=color;el.style.borderLeftColor=color;document.querySelectorAll(`[data-palette="${id}"] button`).forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.color===color));b.disabled=el.disabled;});}
function syncControls(){for(const key of ['source','font','fontSize','padding'])$(key).value=state[key];for(const key of ['color','background'])setColor(key,state[key]);$('bold').checked=state.bold||false;const scale=String(state.exportScale??1);if(!Array.from($('exportScale').options).some(o=>o.value===scale))$('exportScale').add(new Option(scale+'倍',scale));$('exportScale').value=scale;$('transparent').checked=state.transparent;$('paddingValue').textContent=state.padding+' px';$('backgroundLabel').hidden=state.transparent;}
function fontForState(char,project=state,override){if(override){const font=fonts.get(override);if(!font)throw Error(`指定されたフォント「${override}」を追加してください。`);if(font.charToGlyphIndex(char))return font;const fallback=fonts.get('fallback')||fonts.get('times');if(fallback?.charToGlyphIndex(char))return fallback;throw Error(`「${char}」を表示できるフォントがありません。`);}if(isMathSymbol(char)){const ids=project.symbolFont==='euclid'?['euclid-symbol','euclid-symbol-bold','euclid','times']:project.symbolFont==='times'?['times']:[];for(const id of ids){const font=fonts.get(id);if(font?.charToGlyphIndex(char))return font;}}const preferred=fonts.get(project.font)||fonts.get('times')||fonts.values().next().value;if(preferred?.charToGlyphIndex(char))return preferred;const fallback=fonts.get('fallback');if(fallback?.charToGlyphIndex(char))return fallback;throw Error(`「${char}」を表示できるフォントがありません。対応フォントを追加してください。`);}
function chooseFont(char,font){return fontForState(char,state,font);}
const fontLabel=document.createElement('label');fontLabel.className='selection-font';fontLabel.textContent='フォント';const charFont=document.createElement('select');charFont.id='charFont';charFont.setAttribute('aria-label','選択文字のフォント');fontLabel.append(charFont);document.querySelector('.selection-controls').append(fontLabel);
function syncSelectionFont(){const glyphs=rendered?.items.filter(g=>selection.has(g.id)&&g.type==='glyph')||[];const values=new Set(glyphs.map(g=>state.edits[g.id]?.font||''));charFont.replaceChildren(new Option('自動（全体設定に従う）',''));for(const {id,label}of fontOptions())charFont.add(new Option(label,id));if(values.size>1){const mixed=new Option('複数のフォント','mixed');mixed.disabled=true;charFont.add(mixed);charFont.value='mixed';}else charFont.value=[...values][0]||'';charFont.disabled=!glyphs.length;}
charFont.onchange=async()=>{const chosen=charFont.value,ids=[...selection];charFont.disabled=true;try{if(chosen)await ensureFont(chosen);checkpoint();for(const g of rendered?.items||[]){if(!ids.includes(g.id)||g.type!=='glyph')continue;const edit={...state.edits[g.id]};if(chosen)edit.font=chosen;else delete edit.font;state.edits[g.id]=edit;}render();}catch(e){toast(e.message);syncSelectionFont();}};
const boldWidth=()=>state.bold?state.fontSize*96/72*.025:0;
const orderedItems=()=>[...rendered.items.filter(g=>g.type!=='glyph'),...rendered.items.filter(g=>g.type==='glyph')];
function make(tag,attrs={},text){const el=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
function bounds(){return {w:rendered.width+2*state.padding,h:rendered.height+2*state.padding,x:state.padding-rendered.left,y:state.padding-rendered.top};}
function itemMarkup(g){const color=g.color||state.color;const transform=`translate(${g.x} ${g.y})`;if(g.type==='glyph')return `<path d="${escape(g.path)}" fill="${color}" stroke="${color}" stroke-width="${boldWidth()}" stroke-linejoin="round" transform="${transform}"/>`;if(g.type==='line')return `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" fill="${color}"/>`;return `<path d="${escape(g.path)}" fill="none" stroke="${color}" stroke-width="${g.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" transform="${transform}"/>`;}
function drawCanvas(){
  const b=drag?.bounds||bounds(),svg=$('canvas');svg.replaceChildren();svg.setAttribute('viewBox',`0 0 ${b.w} ${b.h}`);svg.style.width=`${b.w*zoom}px`;svg.style.height=`${b.h*zoom}px`;
  if(!state.transparent)svg.append(make('rect',{width:b.w,height:b.h,fill:state.background}));
  const root=make('g',{transform:`translate(${b.x} ${b.y})`});
  // Put large structural hit areas behind characters, so a radical doesn't hide its content.
  const ordered=orderedItems();
  for(const g of ordered){const group=make('g',{transform:`translate(${g.x} ${g.y})`});group.classList.add('glyph');if(selection.has(g.id))group.classList.add('selected');group.dataset.id=g.id;group.append(make('title',{},`${g.text||'数式の線'}：クリックで編集、ドラッグで移動`));
    group.append(make('rect',{class:'hit',x:-2,y:-(g.a||0)-2,width:g.w+4,height:(g.a||0)+(g.d||g.h||0)+4,rx:2}));
    if(g.type==='glyph')group.append(make('path',{d:g.path,fill:g.color||state.color,stroke:g.color||state.color,'stroke-width':boldWidth(),'stroke-linejoin':'round','pointer-events':'none'}));
    else if(g.type==='line')group.append(make('rect',{width:g.w,height:g.h,fill:g.color||state.color,'pointer-events':'none'}));else group.append(make('path',{d:g.path,fill:'none',stroke:g.color||state.color,'stroke-width':g.strokeWidth,'stroke-linecap':'round','stroke-linejoin':'round','pointer-events':'none'}));root.append(group);}
  svg.append(root);$('emptyState').hidden=rendered.items.length>0;const outputScale=state.exportScale??1;$('dimensions').textContent=`出力 ${(b.w/96*2.54*outputScale).toFixed(2)} × ${(b.h/96*2.54*outputScale).toFixed(2)} cm`;$('zoomLabel').textContent=`${Math.round(zoom*100)}%`;
}
function render(){
  try{rendered=layout(parse(state.source,state.layoutVersion??1),state.fontSize*96/72,chooseFont,state.edits,state.layoutVersion??1);invalid=false;editAnchor={source:state.source,edits:clone(state.edits),version:state.layoutVersion??1};$('parseError').textContent='';drawCanvas();}
  catch(e){invalid=true;$('parseError').textContent=e.message;$('canvas').replaceChildren();rendered=null;}
  for(const id of ['copy','png','svg'])$(id).disabled=invalid||!state.source.trim();updateSelection();updateHistory();
}
function updateSelection(){syncSelectionFont();const g=rendered?.items.find(g=>g.id===selected);for(const id of ['character','offsetX','offsetY','charColor'])$(id).disabled=!g;$('character').disabled=!g||selection.size!==1||g.type!=='glyph';if(!g){$('selectionHint').textContent='Shiftクリック／空白をドラッグで範囲選択';$('character').value='';$('offsetX').value='';$('offsetY').value='';setColor('charColor',state.color);return;}
  const e=state.edits[selected]||{};$('selectionHint').textContent=selection.size>1?`${selection.size}パーツを選択・まとめて移動／色変更`:`「${g.text||'数式の線'}」を編集中`;$('character').value=selection.size===1?(e.text??g.text??''):'';$('offsetX').value=e.x||0;$('offsetY').value=e.y||0;setColor('charColor',e.color||state.color);
}
function editSelected(change){if(!selected)return;checkpoint();const base=state.edits[selected]||{};for(const id of selection){const old=state.edits[id]||{},next={...old,...change};if(change.x!==undefined)next.x=(old.x||0)+change.x-(base.x||0);if(change.y!==undefined)next.y=(old.y||0)+change.y-(base.y||0);state.edits[id]=next;}render();}
function updateSource(source,preserve=true,range=null){checkpoint();let edits={};if(preserve&&editAnchor){try{edits=remapEdits(editAnchor.source,source,parse(editAnchor.source,editAnchor.version),parse(source),editAnchor.edits,editAnchor.source===state.source?range:null);}catch{edits=clone(editAnchor.edits);}}else editAnchor=null;state.source=source;state.layoutVersion=2;state.edits=edits;clearSelection();$('source').value=source;render();}
$('source').addEventListener('beforeinput',()=>{inputRange={start:$('source').selectionStart,end:$('source').selectionEnd};});
$('source').addEventListener('input',()=>{updateSource($('source').value,true,inputRange);inputRange=null;});
for(const id of ['font','fontSize','color','background','padding','transparent','bold','exportScale'])$(id).addEventListener('change',async()=>{let value=['transparent','bold'].includes(id)?$(id).checked:['fontSize','padding','exportScale'].includes(id)?Number($(id).value):$(id).value;if(id==='font'){try{await ensureFont(value);}catch(e){toast(e.message);syncControls();return;}}if(id==='fontSize')value=Math.max(8,Math.min(144,value||28));if(id==='padding')value=Math.max(0,Math.min(80,value||0));checkpoint();state[id]=value;syncControls();render();});
$('character').addEventListener('change',()=>editSelected({text:$('character').value}));for(const [id,key]of [['offsetX','x'],['offsetY','y']])$(id).addEventListener('input',()=>editSelected({[key]:Math.max(-5000,Math.min(5000,Number($(id).value)||0))}));$('charColor').addEventListener('change',()=>editSelected({color:$('charColor').value}));
const marquee=document.createElement('div');marquee.id='marquee';marquee.hidden=true;document.body.append(marquee);
$('stage').addEventListener('pointerdown',e=>{
  if(!rendered||e.button!==0)return;const target=e.target.closest('.glyph');
  if(target){const id=target.dataset.id,glyphs=rendered.items;
    if(e.shiftKey&&selectionAnchor){const a=glyphs.findIndex(g=>g.id===selectionAnchor),b=glyphs.findIndex(g=>g.id===id);selection.clear();glyphs.slice(Math.min(a,b),Math.max(a,b)+1).forEach(g=>selection.add(g.id));}
    else if(e.ctrlKey||e.metaKey){selection.has(id)?selection.delete(id):selection.add(id);selectionAnchor=id;}
    else if(!selection.has(id)){selection.clear();selection.add(id);selectionAnchor=id;}
    selected=selection.has(id)?id:[...selection][0]||null;
    drag={kind:'move',startX:e.clientX,startY:e.clientY,moved:false,bounds:bounds(),initial:Object.fromEntries([...selection].map(id=>[id,{...state.edits[id]}]))};
  }else{const previous=e.ctrlKey?new Set(selection):new Set();if(!e.ctrlKey)clearSelection();drag={kind:'select',startX:e.clientX,startY:e.clientY,bounds:bounds(),previous};}
  e.preventDefault();$('stage').setPointerCapture(e.pointerId);$('stage').focus();drawCanvas();updateSelection();
});
$('stage').addEventListener('pointermove',e=>{
  if(!drag||!rendered)return;
  if(drag.kind==='select'){
    const left=Math.min(e.clientX,drag.startX),top=Math.min(e.clientY,drag.startY),right=Math.max(e.clientX,drag.startX),bottom=Math.max(e.clientY,drag.startY);Object.assign(marquee.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});marquee.hidden=false;
    const rect=$('canvas').getBoundingClientRect(),b=drag.bounds;selection.clear();drag.previous.forEach(id=>selection.add(id));
    for(const g of rendered.items){const x=rect.left+(b.x+g.x)*zoom,y=rect.top+(b.y+g.y)*zoom;if(x+g.w*zoom>=left&&x<=right&&y+(g.d||g.h||0)*zoom>=top&&y-(g.a||0)*zoom<=bottom)selection.add(g.id);}
    selected=[...selection][0]||null;selectionAnchor=selected;drawCanvas();updateSelection();return;
  }
  const dx=(e.clientX-drag.startX)/zoom,dy=(e.clientY-drag.startY)/zoom;if(!drag.moved&&Math.hypot(dx,dy)<2)return;if(!drag.moved){checkpoint();drag.moved=true;}
  for(const [id,old]of Object.entries(drag.initial))state.edits[id]={...old,x:Math.round(((old.x||0)+dx)*2)/2,y:Math.round(((old.y||0)+dy)*2)/2};render();
});
function endDrag(){drag=null;marquee.hidden=true;if(rendered)drawCanvas();}$('stage').addEventListener('pointerup',endDrag);$('stage').addEventListener('pointercancel',endDrag);
$('canvas').addEventListener('dblclick',()=>{if(selected){$('character').focus();$('character').select();}});
$('stage').addEventListener('keydown',e=>{if(!selected||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey?5:.5,old=state.edits[selected]||{};editSelected({x:(old.x||0)+(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0),y:(old.y||0)+(e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0)});});
$('resetPositions').onclick=()=>{checkpoint();for(const e of Object.values(state.edits)){delete e.x;delete e.y;}render();};
function undo(){if(!history.length)return;future.push(clone(state));state=history.pop();clearSelection();syncControls();render();}function redo(){if(!future.length)return;history.push(clone(state));state=future.pop();clearSelection();syncControls();render();}$('undo').onclick=undo;$('redo').onclick=redo;
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();e.shiftKey?redo():undo();}});
$('zoomIn').onclick=()=>{zoom=Math.min(3,zoom+.25);if(rendered)drawCanvas();};$('zoomOut').onclick=()=>{zoom=Math.max(.25,zoom-.25);if(rendered)drawCanvas();};
const templates=[['a/b','分数','\\frac{a}{b}'],['√x','平方根','\\sqrt{x}'],['x²','上付き','x^{2}'],['xₙ','下付き','x_{n}'],['∑','総和','\\sum_{i=1}^{n}x_i'],['∫','積分','\\int_{0}^{1}x\\,dx']];
function sourceRange(){const glyphs=rendered?.items.filter(g=>selection.has(g.id)&&Number.isInteger(g.sourceStart))||[];if(glyphs.length){let start=Math.min(...glyphs.map(g=>g.sourceStart)),end=Math.max(...glyphs.map(g=>g.sourceEnd));let balance=0;for(const c of state.source.slice(start,end)){if(c==='{')balance++;if(c==='}')balance--;}while(balance>0&&state.source[end]==='}'){end++;balance--;}return [start,end];}return [$('source').selectionStart,$('source').selectionEnd];}
function insert(text,kind){const input=$('source'),[start,end]=sourceRange();const result=kind?transformSelection(input.value,start,end,kind):insertAfterSelection(input.value,start,end,text);updateSource(result.source,true,kind?null:{start:Math.max(start,end),end:Math.max(start,end)});input.focus();input.setSelectionRange(result.start,result.end);}
for(const[math,label,code]of templates){const b=document.createElement('button');b.innerHTML=`<span class="math">${math}</span><small>${label}</small>`;b.title=label+'を追加';b.onclick=()=>insert(code,{'平方根':'sqrt','上付き':'sup','下付き':'sub'}[label]);$('templates').append(b);}for(const symbol of ['α','β','θ','λ','π','σ','Δ','∞','±','×','≤','≥']){const b=document.createElement('button');b.textContent=symbol;b.setAttribute('aria-label',symbol+'を追加');b.onclick=()=>insert(symbol);$('symbols').append(b);}
$('source').addEventListener('select',()=>{if(document.activeElement!==$('source'))return;const a=$('source').selectionStart,b=$('source').selectionEnd;selection.clear();for(const g of rendered?.items||[])if(g.type==='glyph'&&g.sourceStart<b&&g.sourceEnd>a)selection.add(g.id);selected=[...selection][0]||null;if(rendered)drawCanvas();updateSelection();});
function selectAll(){selection.clear();rendered?.items.forEach(g=>selection.add(g.id));selected=[...selection][0]||null;selectionAnchor=selected;if(rendered)drawCanvas();updateSelection();}
$('selectAll').onclick=selectAll;$('stage').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='a'){e.preventDefault();selectAll();}});
const examples={quadratic:'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',integral:'\\int_{0}^{\\infty}e^{-x}\\,dx=1',sum:'\\sum_{i=1}^{n}i=\\frac{n(n+1)}{2}',matrix:'A=\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'};for(const b of document.querySelectorAll('[data-example]'))b.onclick=()=>updateSource(examples[b.dataset.example],false);
function baseSvgText(){if(invalid||!rendered)throw Error('数式を確認してください。');const b=bounds(),scale=state.exportScale??1;return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.w*.75*scale}pt" height="${b.h*.75*scale}pt" viewBox="0 0 ${b.w} ${b.h}"><metadata id="ceol-formula">${escape(JSON.stringify(state))}</metadata>${state.transparent?'':`<rect width="100%" height="100%" fill="${state.background}"/>`}<g transform="translate(${b.x} ${b.y})">${orderedItems().map(itemMarkup).join('')}</g></svg>`;}
function svgText(){return baseSvgText().replace('<metadata', '<path fill="#000000" stroke="none" stroke-width="0" d="'+vectorDataPath(state)+'"/><metadata');}
async function pngBlob(){const snapshot=clone(state),b=bounds(),scale=Number($('scale').value),ratio=scale*(state.exportScale??1),w=Math.ceil(b.w*ratio),h=Math.ceil(b.h*ratio);if(w*h>32e6||w>16000||h>16000)throw Error('画像が大きすぎます。解像度またはフォントサイズを下げてください。');const url=URL.createObjectURL(new Blob([svgText()],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,b.w*ratio,b.h*ratio);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNGを書き出せませんでした。');const result=new Blob([embedPNG(new Uint8Array(await blob.arrayBuffer()),snapshot,scale)],{type:'image/png'});await rememberImage(result,snapshot);return result;}finally{URL.revokeObjectURL(url);}}
async function fingerprint(blob){const image=await createImageBitmap(blob);try{if(image.width*image.height>32e6)throw Error('画像が大きすぎます。');const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height).data;const digest=await crypto.subtle.digest('SHA-256',pixels);return `${c.width}x${c.height}:`+Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');}finally{image.close();}}
function readCache(){try{const entries=JSON.parse(localStorage.getItem('ceol-image-projects')||'[]');return Array.isArray(entries)?entries.filter(e=>e&&e.project).slice(0,30):[];}catch{return [];}}
async function rememberImage(blob,project){try{const key=await fingerprint(blob),cache=readCache().filter(e=>e.key!==key);cache.unshift({key,project});localStorage.setItem('ceol-image-projects',JSON.stringify(cache.slice(0,30)));}catch{/* Export still works when browser storage is full or unavailable. */}}
async function recoverImage(blob){try{const key=await fingerprint(blob);return readCache().find(e=>e.key===key)?.project||null;}catch{return null;}}
async function nativeRequest(mode,data={}){const response=await fetch(`/api/clipboard/${mode}`,{method:'POST',headers:{'Content-Type':'application/json','X-Ceol-Request':'1'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok||result.error)throw Error(result.error||'クリップボード処理に失敗しました。');return result;}
async function dataURL(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('画像を読み込めません。'));r.readAsDataURL(blob);});}
function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function action(id,fn){$(id).onclick=async()=>{try{await fn();}catch(e){toast(e.message||'処理に失敗しました。');}};}
action('svg',()=>{download(new Blob([svgText()],{type:'image/svg+xml'}),'formula.svg');toast('編集データ付きSVGを保存しました。');});
action('png',async()=>{download(await pngBlob(),'formula.png');toast('編集データ付きPNGを保存しました。');});
action('copy',async()=>{
  if(!rendered||invalid)throw Error('数式を確認してください。');const vector=$('copyFormat').value==='vector',snapshot=clone(state),svg=svgText(),b=bounds();
  if(vector&&nativeClipboard){const items=orderedItems().map(g=>({...g,color:g.color||state.color})),stroke=boldWidth();$('copy').disabled=true;try{const blob=await pngBlob();await nativeRequest('copy',{width:b.w,height:b.h,offsetX:b.x,offsetY:b.y,scale:snapshot.exportScale??1,boldWidth:stroke,transparent:snapshot.transparent,background:snapshot.background,project:JSON.stringify(snapshot),svg,png:(await dataURL(blob)).split(',')[1],items});toast('ベクター（SVG／EMF）と編集情報をコピーしました。PPTへ貼り付けられます。');}finally{$('copy').disabled=invalid;}return;}
  if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined'){download(await pngBlob(),'formula.png');toast('コピーが使えないためPNGを保存しました。');return;}
  const data={'image/png':pngBlob()};
  if(vector&&ClipboardItem.supports?.('image/svg+xml'))data['image/svg+xml']=new Blob([svg],{type:'image/svg+xml'});
  await navigator.clipboard.write([new ClipboardItem(data)]);toast(vector?'PNGと編集情報をコピーしました。PPTのベクター貼り付けにはWindowsローカル版を使ってください。':'PNGと編集情報をコピーしました。');
});
action('saveProject',()=>{if(invalid)throw Error('数式を確認してから保存してください。');download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),'formula.ceol.json');toast('編集データを保存しました。');});
async function importFile(file){
  if(!file)return;if(file.size>15*1024*1024)throw Error('15MB以下の画像・編集データを選んでください。');
  let project=null;const extension=file.name.split('.').pop().toLowerCase();
  if(extension==='json')project=JSON.parse(await file.text());
  else if(extension==='svg'){const doc=new DOMParser().parseFromString(await file.text(),'image/svg+xml');if(doc.querySelector('parsererror'))throw Error('SVGファイルが破損しています。');const meta=doc.querySelector('metadata#ceol-formula');if(meta)project=JSON.parse(meta.textContent);if(!project)for(const path of doc.querySelectorAll('path[d]')){project=projectFromVectorPath(path.getAttribute('d'));if(project)break;}if(!project)throw Error('編集データのないSVGです。PNGまたはJPEGに変換してAIで読み取ってください。');}
  else if(extension==='png'||file.type==='image/png')project=extractPNG(new Uint8Array(await file.arrayBuffer()));
  if(!project&&(/^image\/(png|jpeg|webp)$/.test(file.type)||['png','jpg','jpeg','webp'].includes(extension)))project=await recoverImage(file);
  if(project){await restoreProject(project);return;}
  if(!['png','jpg','jpeg','webp'].includes(extension)&&!/^image\/(png|jpeg|webp)$/.test(file.type))throw Error('PNG・JPEG・WebP・SVG・編集用JSONを選んでください。');
  attachedImage=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('画像を読み込めませんでした。'));reader.readAsDataURL(file);});$('imagePreview').hidden=false;document.querySelector('#imagePreview img').src=attachedImage;toast('編集情報のない画像を添付しました。AIで読み取る場合は「数式に変換」を使ってください。');
}
$('importBtn').onclick=()=>$('fileInput').click();$('fileInput').onchange=async e=>{try{await importFile(e.target.files[0]);}catch(e){toast(e.message);}finally{$('fileInput').value='';}};
$('clearImage').onclick=()=>{attachedImage=null;$('imagePreview').hidden=true;document.querySelector('#imagePreview img').removeAttribute('src');};
$('stage').addEventListener('dragover',e=>{e.preventDefault();});$('stage').addEventListener('drop',async e=>{e.preventDefault();try{await importFile(e.dataTransfer.files[0]);}catch(e){toast(e.message);}});
async function restoreProject(project){const valid=validateProject(project);await Promise.all([...new Set([valid.font,...Object.values(valid.edits).map(e=>e.font).filter(Boolean)])].map(ensureFont));layout(parse(valid.source,valid.layoutVersion??1),valid.fontSize*96/72,(c,font)=>fontForState(c,valid,font),valid.edits,valid.layoutVersion??1);setState(valid);toast('数式と文字の調整位置を復元しました。');}
async function pasteNative(){const result=await nativeRequest('paste');if(result.project){await restoreProject(JSON.parse(result.project));return;}if(result.svg){const doc=new DOMParser().parseFromString(result.svg,'image/svg+xml');const meta=doc.querySelector('metadata#ceol-formula');let project=meta?JSON.parse(meta.textContent):null;if(!project)for(const path of doc.querySelectorAll('path[d]')){project=projectFromVectorPath(path.getAttribute('d'));if(project)break;}if(project){await restoreProject(project);return;}}if(result.image){const blob=await (await fetch(result.image)).blob();await importFile(new File([blob],'pasted.png',{type:'image/png'}));return;}throw Error('貼り付けできる画像がありません。');}
action('pasteImage',async()=>{if(nativeClipboard)return pasteNative();if(!navigator.clipboard?.read)throw Error('Ctrl+Vで貼り付けるか、PPTからPNGを保存して読み込んでください。');const items=await navigator.clipboard.read();for(const item of items){if(item.types.includes('text/plain')){const p=decodeProject(await(await item.getType('text/plain')).text());if(p){await restoreProject(p);return;}}for(const type of item.types.filter(t=>t.startsWith('image/'))){const blob=await item.getType(type);await importFile(new File([blob],type==='image/svg+xml'?'pasted.svg':'pasted.png',{type}));return;}}throw Error('画像がありません。PPTで画像や図形を選択してコピーしてください。');});
document.addEventListener('paste',async e=>{const text=e.clipboardData.getData('text/plain'),file=Array.from(e.clipboardData.items).find(i=>i.type.startsWith('image/'))?.getAsFile();if(text.startsWith('CEOL_FORMULA_V1:')){e.preventDefault();try{await restoreProject(decodeProject(text));}catch(e){toast(e.message);}return;}if(file){e.preventDefault();try{if(nativeClipboard)await pasteNative();else await importFile(file);}catch(e){toast(e.message);}return;}if(!['INPUT','TEXTAREA'].includes(e.target.tagName)&&nativeClipboard){e.preventDefault();try{await pasteNative();}catch(e){toast(e.message);}}});
$('addFont').onclick=()=>$('fontInput').click();$('fontInput').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>25e6)throw Error('25MB以下のフォントを選んでください。');const font=mapNamedSymbols(opentype.parse(await file.arrayBuffer())),id='custom:'+file.name;fonts.set(id,font);if(!Array.from($('font').options).some(o=>o.value===id)){const option=new Option(font.names.fullName?.en||file.name,id);$('font').add(option);}checkpoint();state.font=id;syncControls();render();toast('フォントを追加しました。');}catch(e){toast('フォントを読み込めませんでした。'+e.message);}finally{$('fontInput').value='';}};
$('helpBtn').onclick=()=>$('help').showModal();$('settingsBtn').onclick=()=>$('settings').showModal();
// Keys are kept only in memory; provider endpoints are fixed, not imported from files.
$('applySettings').onclick=()=>{const model=$('apiModel').value.trim();if(!/^[a-zA-Z0-9_.:/-]{1,120}$/.test(model)){toast('利用するモデル名を入力してください。');return;}settings={provider:$('apiProvider').value,model,key:$('apiKey').value.trim()};$('apiKey').value='';$('settings').close();toast('AI接続を設定しました。キーはこのタブを閉じると消去されます。');};
$('apiProvider').onchange=()=>{$('apiModel').value='';$('apiModel').placeholder=$('apiProvider').value==='gemini'?'例：Google AI Studioで利用可能なモデル名':'例：OpenAIで利用可能なモデル名';};
action('generate',async()=>{if(!settings.key||!settings.model){$('settings').showModal();toast('APIキーとモデル名を設定してください。');return;}if(!$('prompt').value.trim()&&!attachedImage)throw Error('数式の説明か画像を入力してください。');const button=$('generate'),before=state.source;button.disabled=true;button.textContent='読み取り中…';try{const source=await interpret(settings,$('prompt').value,attachedImage);parse(source);if(state.source!==before)throw Error('処理中に数式が編集されたため、反映を中止しました。もう一度実行してください。');updateSource(source);if(invalid)throw Error('AIの出力に未対応の文字が含まれています。数式を修正してください。');toast('数式を生成しました。内容を確認してからお使いください。');}finally{button.disabled=false;button.textContent='✧ 数式に変換';}});
for(const id of ['color','charColor','background']){for(const [color,label]of [...NEUTRALS,...OFFICE_COLORS])$(id).add(new Option(label,color));}
const palette=document.createElement('div');palette.className='palette';palette.dataset.palette='color';palette.setAttribute('aria-label','PowerPoint標準色');for(const [color,label]of [...NEUTRALS,...OFFICE_COLORS]){const button=document.createElement('button');button.type='button';button.style.background=color;button.title=label;button.setAttribute('aria-label',`全体を${label}にする`);button.dataset.color=color;button.onclick=()=>{$('color').value=color;$('color').dispatchEvent(new Event('change'));};palette.append(button);}$('color').closest('.two-columns').after(palette);
async function init(){
  try{
    const capabilities=await(await fetch('/api/capabilities')).json();nativeClipboard=capabilities.nativeClipboard===true;
    const response=await fetch('/api/fonts',{headers:{'X-Ceol-Request':'1'}});if(!response.ok)throw Error('ローカルサーバーを再起動してください。');
    const data=await response.json();for(const entry of data.fonts)fontCatalog.set(entry.id,entry);
    $('font').replaceChildren(...fontOptions().map(({id,label})=>new Option(label,id)));
    const preferences=['ceol-italic','times','ceol',...fontCatalog.keys()];let initial;
    for(const id of [...new Set(preferences)]){if(!fontCatalog.has(id))continue;try{await ensureFont(id);initial=id;break;}catch{}}
    if(!initial)throw Error('利用できるTTF／OTFがありません。「フォントを追加」から読み込んでください。');
    state.font=initial;
    for(const id of ['euclid','euclid-symbol','euclid-symbol-bold','times','fallback'])if(fontCatalog.has(id))try{await ensureFont(id);}catch{}
    const symbolHint=$('font').parentElement.querySelector('p');if(symbolHint)symbolHint.textContent=(fonts.has('euclid-symbol')||fonts.has('euclid-symbol-bold'))?'記号：Euclid Symbol系。個別指定を優先します。':fonts.has('times')?'Euclid未導入：記号はTimes New Romanで代用します。':'Euclid未導入：記号は選択フォントで代用します。';
    syncControls();render();
  }catch(e){$('parseError').textContent=e.message;for(const id of ['copy','png','svg'])$(id).disabled=true;}
}
await init();
if(document.modelContext?.registerTool){const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});try{await document.modelContext.registerTool({name:'set_equation',title:'数式を設定',description:'数式の入力欄とキャンバスを更新します。変更していない文字の位置調整は保持します。',inputSchema:{type:'object',properties:{source:{type:'string',maxLength:4000}},required:['source'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){if(typeof input?.source!=='string')throw Error('source must be a string');const tree=parse(input.source);layout(tree,state.fontSize*96/72,chooseFont,{});updateSource(input.source);return {source:state.source,glyphs:rendered.items.filter(g=>g.type==='glyph').length};}},{signal:lifecycle.signal});}catch{/* Optional browser proposal; core editing remains available. */}}








