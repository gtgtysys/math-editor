import {testFont} from './test-font.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import opentype from 'opentype.js';
import {parse,layout,validateProject} from '../dist/engine.js';import {remapEdits} from '../dist/editing.js';import {vectorDataPath,projectFromVectorPath} from '../dist/vector-data.js';
const italic=testFont('Ceol-Italic.ttf'),regular=testFont('Ceol-Regular.ttf');
test('per-character font changes only the selected glyph and survives insertion and vector data',()=>{
  const tree=parse('xx'),pick=(c,id)=>id==='ceol'?regular:italic,base=layout(tree,32,pick),edits={n0:{font:'ceol',x:19,y:75}},changed=layout(tree,32,pick,edits);
  assert.notEqual(base.items[0].path,changed.items[0].path);assert.equal(base.items[1].path,changed.items[1].path);
  assert.equal(changed.items[0].y,75);assert.equal(remapEdits('xx','axx',tree,parse('axx'),edits).n1.font,'ceol');
  const project={app:'ceol-formula-studio',version:1,layoutVersion:2,source:'xx',font:'ceol-italic',fontSize:28,padding:12,color:'#000000',background:'#ffffff',transparent:true,edits};
  assert.deepEqual(validateProject(projectFromVectorPath(vectorDataPath(project))).edits,edits);
  assert.throws(()=>validateProject({...project,edits:{n0:{font:42}}}));
});
