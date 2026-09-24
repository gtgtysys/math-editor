import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,layout} from '../dist/engine.js';
import {testFont} from './test-font.mjs';
const font=testFont('Ceol-Regular.ttf');
test('custom radicals clear their body, join the bar and retain edits for tall and nested formulas',()=>{
  for(const source of ['\\sqrt{x}','\\sqrt{\\frac{1}{\\frac{2}{3}}}','\\sqrt[3]{x}','\\sqrt{\\sqrt{x}}']){
    const tree=parse(source),normal=layout(tree,40,()=>font);
    const radicals=normal.items.filter(g=>g.type==='stroke');
    for(const g of radicals){
      const p=g.path.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
      assert.equal(p.length,10);
      assert.equal(p[7],p[9]); // The rising stem meets the horizontal bar.
      assert.ok(p[7]<p[5]);
      assert.ok(p.every(Number.isFinite));
      const moved=layout(tree,40,()=>font,{[g.id]:{x:17,y:-9,color:'#0070C0'}}).items.find(v=>v.id===g.id);
      assert.equal(moved.path,g.path);
      assert.equal(moved.x,g.x+17);
      assert.equal(moved.y,g.y-9);
      assert.equal(moved.color,'#0070C0');
    }
  }
});
