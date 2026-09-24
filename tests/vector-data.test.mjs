import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vectorDataPath,projectFromVectorPath} from '../dist/vector-data.js';
import {validateProject} from '../dist/engine.js';

test('zero-area vector data survives Office coordinate rounding and implicit line commands',()=>{
  const project={source:'α+日本語',edits:{n0:{x:18,y:-7,color:'#0070C0'}}};
  const path=vectorDataPath(project);
  const rewritten=path.replace(/\d*\.\d+/g,n=>Number(n).toPrecision(6)).replace(/L/g,' ');
  assert.deepEqual(projectFromVectorPath(rewritten),project);
  assert.equal(projectFromVectorPath('M0 0 L1 1 Z'),null);
  assert.equal(projectFromVectorPath('M0 0 L0.1 0 Z'),null);
});

test('actual PowerPoint clipboard SVG after resizing restores source and all manual edits without history',()=>{
  const svg=readFileSync(new URL('./ppt-marker-resized.svg',import.meta.url),'utf8');
  assert.ok(!svg.includes('<metadata'));
  const project=[...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m=>projectFromVectorPath(m[1])).find(Boolean);
  const valid=validateProject(project);
  assert.equal(valid.source,'f(x)=\\frac{-b+\\sqrt{b^2-4ac}}{2a}');
  assert.equal(valid.font,'ceol-italic');
  assert.ok(Object.keys(valid.edits).length>10);
  for(const edit of Object.values(valid.edits)){assert.equal(edit.x,18);assert.equal(edit.color,'#0070C0');}
});
