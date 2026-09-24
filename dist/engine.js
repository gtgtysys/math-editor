import {layout as legacyLayout,parse as legacyParse} from './legacy-engine.js';
// A small, deliberately bounded math grammar. Unknown commands are errors,
// never silently converted to a different equation.
export const COMMANDS = {alpha:'α',beta:'β',gamma:'γ',delta:'δ',epsilon:'ε',theta:'θ',lambda:'λ',mu:'μ',nu:'ν',xi:'ξ',pi:'π',rho:'ρ',sigma:'σ',tau:'τ',phi:'φ',chi:'χ',psi:'ψ',omega:'ω',Gamma:'Γ',Delta:'Δ',Theta:'Θ',Lambda:'Λ',Sigma:'Σ',Phi:'Φ',Psi:'Ψ',Omega:'Ω',infty:'∞',times:'×',cdot:'·',pm:'±',mp:'∓',div:'÷',le:'≤',leq:'≤',ge:'≥',geq:'≥',ne:'≠',neq:'≠',approx:'≈',equiv:'≡',to:'→',rightarrow:'→',leftarrow:'←',Rightarrow:'⇒',partial:'∂',nabla:'∇',in:'∈',notin:'∉',subset:'⊂',cup:'∪',cap:'∩',forall:'∀',exists:'∃',ldots:'…',cdots:'⋯',prime:'′',ell:'ℓ',hbar:'ℏ'};
export function parse(source,layoutVersion=2) {
  if(layoutVersion===1)return legacyParse(source);
  if (source.length > 4000) throw Error('数式は4,000文字以内にしてください。');
  let i=0, serial=0, depth=0;
  const node=(type,props={})=>({type,id:`n${serial++}`,...props});
  function sequence(end=null){
    if(++depth>40)throw Error('数式の入れ子が深すぎます。');
    const children=[];
    while(i<source.length && (!end || !source.startsWith(end,i))){
      if(/\s/.test(source[i])){i++;continue;}
      if(source[i]==='}')throw Error('閉じ括弧 } に対応する { がありません。');
      let base=atom();
      const start=base.start;
      while(source[i]==='^'||source[i]==='_'){
        const key=source[i++]==='^'?'sup':'sub';
        const arg=argument();
        if(base.type!=='scripts')base=node('scripts',{base});
        if(base[key])throw Error('同じ文字に上付き・下付きが重複しています。');
        base[key]=arg;
        base.start=start;base.end=i;
      }
      children.push(base);
    }
    if(end){if(!source.startsWith(end,i))throw Error(`閉じ記号 ${end} が必要です。`);i+=end.length;}
    depth--;return node('row',{children});
  }
  function argument(){while(/\s/.test(source[i]||'')&&i<source.length)i++;if(i>=source.length)throw Error('数式パーツの内容を入力してください。');return atom();}
  function atom(){const start=i,n=readAtom();n.start=start;n.end=i;return n;}
  function readAtom(){
    const c=source[i++];
    if(c==='{')return sequence('}');
    if(c==='^'||c==='_')throw Error('上付き・下付きの前に文字が必要です。');
    if(c==='\\'){
      const match=source.slice(i).match(/^[a-zA-Z]+/);
      if(!match){const v=source[i++];if(['{','}','_','%','#','&','$',' '].includes(v))return node('char',{value:v});if([',',';',':','!'].includes(v))return node('space',{factor:{',':3/18,':':4/18,';':5/18,'!':-3/18}[v]});throw Error('未対応の記号です。');}
      const cmd=match[0];i+=cmd.length;
      if(cmd==='frac'||cmd==='dfrac'||cmd==='tfrac')return node('frac',{num:argument(),den:argument()});
      if(cmd==='sqrt'){
        let index;if(source[i]==='['){i++;index=sequence(']');}
        return node('sqrt',{body:argument(),index});
      }
      if(['sum','prod','int','oint'].includes(cmd))return node('large',{value:{sum:'∑',prod:'∏',int:'∫',oint:'∮'}[cmd]});
      if(['overline','bar','hat','vec'].includes(cmd))return node('accent',{body:argument(),kind:cmd});
      if(cmd==='left'||cmd==='right'){while(source[i]===' ')i++;if(source[i]==='.') {i++;return node('space',{factor:0});}return atom();}
      if(cmd==='text'||cmd==='mathrm'||cmd==='operatorname'){
        while(source[i]===' ')i++;
        if(source[i++]!=='{')throw Error(`\\${cmd}には {文字} が必要です。`);
        const end=source.indexOf('}',i);if(end<0)throw Error('文字の閉じ括弧 } が必要です。');
        let offset=i;const children=Array.from(source.slice(i,end),value=>{const start=offset;offset+=value.length;return node('char',{value,start,end:offset});});i=end+1;return node('row',{children,atomClass:cmd==='operatorname'?'op':'ord',textMode:true});
      }
      if(['sin','cos','tan','log','ln','exp','lim','max','min'].includes(cmd))return node('row',{children:Array.from(cmd,(value,index)=>node('char',{value,start:i-cmd.length+index,end:i-cmd.length+index+1})),atomClass:'op',textMode:true});
      if(cmd==='quad'||cmd==='qquad')return node('space',{factor:cmd==='quad'?1:2});
      if(cmd==='begin'){
        const m=source.slice(i).match(/^\{(pmatrix|bmatrix|matrix)\}/);if(!m)throw Error('対応する行列は matrix / pmatrix / bmatrix です。');i+=m[0].length;
        const end=`\\end{${m[1]}}`, stop=source.indexOf(end,i);if(stop<0)throw Error('行列の終わりがありません。');
        const body=source.slice(i,stop);let cellOffset=i;i=stop+end.length;
        function shift(n,offset){if(n.start!==undefined){n.start+=offset;n.end+=offset;}for(const v of Object.values(n))if(v&&typeof v==='object'){if(Array.isArray(v))v.flat(2).forEach(x=>x?.type&&shift(x,offset));else if(v.type)shift(v,offset);}}
        const rows=body.split('\\\\').map(row=>{const cells=row.split('&').map(cell=>{const n=parse(cell);shift(n,cellOffset);cellOffset+=cell.length+1;return n;});cellOffset++;return cells;});
        if(rows.length>12||rows.some(r=>r.length>12))throw Error('行列は12行12列までです。');
        // Give nested parses globally unique IDs for per-glyph edits.
        function rekey(n){n.id=`n${serial++}`;for(const v of Object.values(n))if(v&&typeof v==='object'){if(Array.isArray(v))v.flat(2).forEach(x=>x?.type&&rekey(x));else if(v.type)rekey(v);}}
        rows.flat().forEach(rekey);return node('matrix',{rows,bracket:m[1]});
      }
      if(COMMANDS[cmd])return node('char',{value:COMMANDS[cmd]});
      throw Error(`\\${cmd} は未対応です。数式パーツから入力してください。`);
    }
    return node('char',{value:c==='-'?'−':c});
  }
  return sequence();
}

const box=(w=0,a=0,d=0,items=[])=>({w,a,d,items});
const move=(b,x,y)=>b.items.map(g=>({...g,x:g.x+x,y:g.y+y}));
// TeX atom spacing in mu (1/18 em); scripts suppress binary/relation spacing.
const SPACING={ord:{op:3,bin:4,rel:5,inner:3},op:{ord:3,op:3,rel:5,inner:3},bin:{ord:4,op:4,open:4,inner:4},rel:{ord:5,op:5,open:5,inner:5},open:{},close:{op:3,bin:4,rel:5,inner:3},punct:{ord:3,op:3,rel:5,open:3,close:3,punct:3,inner:3},inner:{ord:3,op:3,bin:4,rel:5,open:3,punct:3,inner:3}};
export function layout(tree,size,fontFor,edits={},layoutVersion=2){
  if(layoutVersion===1)return legacyLayout(tree,size,fontFor,edits);
  function atomClass(n){if(n.atomClass)return n.atomClass;if(n.type==='scripts')return atomClass(n.base);if(n.type==='large')return 'op';if(n.type==='frac'||n.type==='matrix')return 'inner';if(n.type==='space')return null;if(n.type!=='char')return 'ord';const c=edits[n.id]?.text??n.value;if(/^[+−±∓×÷·*]$/.test(c))return 'bin';if(/^[=<>≤≥≠≈≡∈∉⊂→←⇒]$/.test(c))return 'rel';if(/^[([{]$/.test(c))return 'open';if(/^[)\]}]$/.test(c))return 'close';if(/^[,;:]$/.test(c))return 'punct';return 'ord';}
  const xHeight=s=>{const f=fontFor('x');return f.charToGlyph('x').getBoundingBox().y2*s/f.unitsPerEm;};
  const axis=s=>{const f=fontFor('=');const b=f.charToGlyph('=').getBoundingBox();return (b.y1+b.y2)*.5*s/f.unitsPerEm;};
  function kern(left,right,s){if(!left||!right)return 0;const a=edits[left.id]?.text??left.value,b=edits[right.id]?.text??right.value;if(!a||!b)return 0;const f=fontFor(a.at(-1),edits[left.id]?.font);if(f!==fontFor(b[0],edits[right.id]?.font))return 0;return f.getKerningValue(f.charToGlyph(a.at(-1)),f.charToGlyph(b[0]))*s/f.unitsPerEm;}
  function glyph(n,s,value=n.value){
    const edit=edits[n.id]||{},text=edit.text??value;
    let x=0,paths=[],a=0,d=0,inkLeft=0,inkRight=0;
    for(const c of text){const font=fontFor(c,edit.font),g=font.charToGlyph(c),p=g.getPath(x,0,s),bb=p.getBoundingBox();paths.push(p.toPathData(4));a=Math.max(a,-bb.y1);d=Math.max(d,bb.y2);inkLeft=Math.min(inkLeft,bb.x1);inkRight=Math.max(inkRight,bb.x2);x+=(g.advanceWidth||font.unitsPerEm*.5)*s/font.unitsPerEm;}
    const w=Math.max(x,s*.1);
    return box(w,a,d,[{type:'glyph',id:n.id,text,x:0,y:0,w,inkLeft,inkRight,a,d,path:paths.join(' '),color:edit.color,sourceStart:n.start,sourceEnd:n.end}]);
  }
  const line=(id,x,y,w,thickness)=>({type:'line',id,x,y,w,h:thickness});
  function lay(n,s,style=0){const b=layBody(n,s,style);for(const g of b.items)if(g.id===n.id&&g.sourceStart===undefined){g.sourceStart=n.start;g.sourceEnd=n.end;}return b;}
  function layBody(n,s,style=0){
    if(n.type==='char')return glyph(n,s);
    if(n.type==='large'){
      const b=glyph(n,s*(style===0?1.45:1.15)),dy=(b.a-b.d)/2-axis(s);
      return box(b.w,b.a-dy,b.d+dy,move(b,0,dy));
    }
    if(n.type==='space')return box(n.factor*s);
    if(n.type==='row'){
      const classes=n.children.map(atomClass),visible=classes.map((c,i)=>c===null?-1:i).filter(i=>i>=0);
      // A sign at the beginning, after an operator, or before a closing delimiter is unary.
      visible.forEach((i,j)=>{if(classes[i]==='bin'&&(j===0||['bin','op','rel','open','punct'].includes(classes[visible[j-1]])||j===visible.length-1||['rel','close','punct'].includes(classes[visible[j+1]])))classes[i]='ord';});
      let out=box(),previous=null;
      n.children.forEach((child,i)=>{const b=lay(child,s,style),type=classes[i];let gap=0;
        if(previous!==null&&type!==null&&!n.textMode){const prev=classes[previous];let mu=SPACING[prev]?.[type]||0;if(style>=2&&!(type==='op'&&['ord','op','close','inner'].includes(prev)||prev==='op'&&type==='ord'))mu=0;gap=mu*s/18;}
        if(i>0&&child.type==='char'&&n.children[i-1].type==='char'&&(n.textMode||classes[i]==='ord'&&classes[i-1]==='ord'))gap+=kern(n.children[i-1],child,s);
        out.items.push(...move(b,out.w+gap,0));out.w+=b.w+gap;out.a=Math.max(out.a,b.a);out.d=Math.max(out.d,b.d);if(type!==null)previous=i;
      });return out;
    }
    if(n.type==='frac'){
      const childStyle=Math.min(3,style+1),scale=style===0?1:style===1?.7:style===2?5/7:1;
      const u=lay(n.num,s*scale,childStyle),v=lay(n.den,s*scale,childStyle),w=Math.max(u.w,v.w)+s*.2,t=s*.04,ay=-axis(s),clearance=t*(style===0?3:1);
      const uy=Math.min(-(style===0?.68:.4)*s,ay-t/2-clearance-u.d),vy=Math.max((style===0?.68:.35)*s,ay+t/2+clearance+v.a);
      return box(w,-uy+u.a,vy+v.d,[...move(u,(w-u.w)/2,uy),...move(v,(w-v.w)/2,vy),line(n.id,0,ay-t/2,w,t)]);
    }
    if(n.type==='scripts'){
      const scriptStyle=Math.min(3,Math.max(2,style+1)),ratio=style<2?.7:style===2?5/7:1;
      const b=lay(n.base,s,style),u=n.sup?lay(n.sup,s*ratio,scriptStyle):box(),v=n.sub?lay(n.sub,s*ratio,scriptStyle):box();
      if(style===0&&n.base.type==='large'&&['∑','∏'].includes(n.base.value)){
        const w=Math.max(b.w,u.w,v.w),uy=-b.a-u.d-s*.13,vy=b.d+v.a+s*.1;
        return box(w,b.a+(n.sup?u.a+u.d+s*.13:0),b.d+(n.sub?v.a+v.d+s*.1:0),[...move(b,(w-b.w)/2,0),...move(u,(w-u.w)/2,uy),...move(v,(w-v.w)/2,vy)]);
      }
      const xh=xHeight(s),simple=n.base.type==='char';
      let up=Math.max((style===0?.413:.363)*s,u.d+xh*.25,simple?0:b.a-.386*s*ratio),down=Math.max((n.sup?.247:.15)*s,v.a-.8*xh,simple?0:b.d+.05*s*ratio);
      if(n.sup&&n.sub){down=Math.max(down,4*.04*s-up+u.d+v.a);const shift=Math.max(0,.8*xh-(up-u.d));up+=shift;down-=shift;}
      const last=b.items.at(-1),italic=simple&&last?Math.max(0,(last.inkRight||0)-last.w):0,supX=b.w+italic,subX=b.w;
      return box(b.w+Math.max(n.sup?italic+u.w:0,n.sub?v.w:0)+s*.05,Math.max(b.a,n.sup?up+u.a:0),Math.max(b.d,n.sub?down+v.d:0),[...b.items,...move(u,supX,-up),...move(v,subX,down)]);
    }
    if(n.type==='sqrt'){
      const b=lay(n.body,s,style),idx=n.index?lay(n.index,s*.5,3):box(),start=Math.max(s*.58,idx.w+s*.15),w=start+b.w+s*.1,top=-b.a-s*.12,bottom=b.d;
      const path=`M ${start-s*.55} ${-s*.08} L ${start-s*.4} ${-s*.2} L ${start-s*.22} ${bottom} L ${start-s*.04} ${top} L ${w} ${top}`;
      return box(w,Math.max(-top,idx.a+s*.35),b.d,[...move(b,start,0),...move(idx,0,-s*.35),{type:'stroke',id:n.id,x:0,y:0,path,strokeWidth:Math.max(1,s*.04),w,a:-top,d:bottom}]);
    }
    if(n.type==='accent'){
      const b=lay(n.body,s,style),y=-b.a-s*.14;let item=line(n.id,0,y,b.w,Math.max(1,s*.04));
      if(n.kind==='hat')item={type:'stroke',id:n.id,x:0,y:0,path:`M 0 ${y} L ${b.w/2} ${y-s*.15} L ${b.w} ${y}`,strokeWidth:s*.04,w:b.w,a:-y+s*.15,d:0};
      if(n.kind==='vec')item={type:'stroke',id:n.id,x:0,y:0,path:`M 0 ${y} H ${b.w} M ${b.w-s*.15} ${y-s*.09} L ${b.w} ${y} L ${b.w-s*.15} ${y+s*.09}`,strokeWidth:s*.04,w:b.w,a:-y+s*.1,d:0};
      return box(b.w,b.a+s*.32,b.d,[...b.items,item]);
    }
    if(n.type==='matrix'){
      const rows=n.rows.map(r=>r.map(c=>lay(c,s))),cols=Math.max(...rows.map(r=>r.length)),widths=Array.from({length:cols},(_,i)=>Math.max(0,...rows.map(r=>r[i]?.w||0))),heights=rows.map(r=>({a:Math.max(...r.map(c=>c.a)),d:Math.max(...r.map(c=>c.d))})),h=heights.reduce((a,b)=>a+b.a+b.d,0)+(rows.length-1)*s*.35,margin=n.bracket==='matrix'?0:s*.35,w=widths.reduce((a,b)=>a+b,0)+(cols-1)*s*.6+margin*2;let y=-h/2-s*.2,items=[];
      rows.forEach((r,ri)=>{y+=heights[ri].a;let x=margin;r.forEach((c,ci)=>{items.push(...move(c,x+(widths[ci]-c.w)/2,y));x+=widths[ci]+s*.6;});y+=heights[ri].d+s*.35;});
      const top=-h/2-s*.3,bot=h/2-s*.1;
      if(margin){const d=n.bracket==='bmatrix'?`M ${margin*.65} ${top} H 0 V ${bot} H ${margin*.65} M ${w-margin*.65} ${top} H ${w} V ${bot} H ${w-margin*.65}`:`M ${margin*.65} ${top} Q ${-margin*.4} ${(top+bot)/2} ${margin*.65} ${bot} M ${w-margin*.65} ${top} Q ${w+margin*.4} ${(top+bot)/2} ${w-margin*.65} ${bot}`;items.push({type:'stroke',id:n.id,x:0,y:0,path:d,strokeWidth:Math.max(1,s*.04),w,a:-top,d:bot});}
      return box(w,-top,bot,items);
    }
    throw Error('不明な数式パーツです。');
  }
  const result=lay(tree,size);
  result.items=result.items.map(g=>{const e=edits[g.id]||{};return {...g,x:g.x+(e.x||0),y:g.y+(e.y||0),...(e.color?{color:e.color}:{})};});
  let left=0,top=-result.a,right=result.w,bottom=result.d;
  for(const g of result.items){left=Math.min(left,g.x+(g.inkLeft||0)-2);right=Math.max(right,g.x+Math.max(g.w,g.inkRight||0)+2);top=Math.min(top,g.y-(g.a||0)-2);bottom=Math.max(bottom,g.y+(g.d||g.h||0)+2);}
  return {...result,left,top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
}

export function validateProject(p){
  if(!p||p.app!=='ceol-formula-studio'||p.version!==1)throw Error('この編集データには対応していません。');
  if(typeof p.source!=='string')throw Error('数式が含まれていません。');parse(p.source);
  const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  if(!number(p.fontSize,8,144)||!number(p.padding,0,80)||!color(p.color)||!color(p.background)||typeof p.transparent!=='boolean'||typeof p.font!=='string'||p.font.length>200)throw Error('画像設定が不正です。');
  if(!p.edits||typeof p.edits!=='object'||Array.isArray(p.edits)||Object.keys(p.edits).length>6000)throw Error('配置データが不正です。');
  const edits={};for(const [k,e]of Object.entries(p.edits)){
    if(!/^n\d+$/.test(k)||!e||typeof e!=='object'||Array.isArray(e))throw Error('文字データが不正です。');
    if(e.x!==undefined&&!number(e.x,-5000,5000)||e.y!==undefined&&!number(e.y,-5000,5000)||e.color!==undefined&&!color(e.color)||e.text!==undefined&&(typeof e.text!=='string'||e.text.length>24))throw Error('文字の設定が不正です。');
    if(e.font!==undefined&&(typeof e.font!=='string'||e.font.length>160))throw Error('文字フォントが不正です。');edits[k]={...e};
  }
  if(p.layoutVersion!==undefined&&![1,2].includes(p.layoutVersion))throw Error('組版バージョンが未対応です。');
  if(p.symbolFont!==undefined&&!['times','euclid'].includes(p.symbolFont))throw Error('記号フォントが未対応です。');
  if(p.exportScale!==undefined&&!number(p.exportScale,.1,3))throw Error('出力倍率が不正です。');
  if(p.bold!==undefined&&typeof p.bold!=='boolean')throw Error('太字の設定が不正です。');
  return {app:p.app,version:1,source:p.source,font:p.font,fontSize:p.fontSize,padding:p.padding,color:p.color,background:p.background,transparent:p.transparent,edits,...(p.layoutVersion!==undefined?{layoutVersion:p.layoutVersion}:{}),...(p.symbolFont?{symbolFont:p.symbolFont}:{}),...(p.exportScale!==undefined?{exportScale:p.exportScale}:{}),...(p.bold!==undefined?{bold:p.bold}:{})};
}

