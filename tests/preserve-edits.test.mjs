import test from 'node:test';import assert from 'node:assert/strict';
import {parse} from '../dist/engine.js';import {remapEdits} from '../dist/editing.js';
function nodes(tree){const list=[];function visit(n){if(!n||typeof n!=='object')return;if(n.id)list.push(n);for(const v of Object.values(n))if(v&&typeof v==='object'){if(Array.isArray(v))v.forEach(visit);else visit(v);}}visit(tree);return list;}
function check(before,after,match,expected,range){const old=parse(before),next=parse(after),node=nodes(old).find(match),edit={x:19,y:75,color:'#0070C0',text:'Z'};const edits=remapEdits(before,after,old,next,{[node.id]:edit},range);const target=nodes(next).find(expected);assert.deepEqual(edits,{[target.id]:edit});}
test('adding before, inside and after formulas retains moved glyphs despite ID changes',()=>{for(const after of ['b+x+y','x+b+y','x+y+b'])check('x+y',after,n=>n.value==='y',n=>n.value==='y');});
test('selection wrapping keeps manual offsets in radicals and exponents',()=>{for(const after of ['x+\\sqrt{25}','x+2^{5}'])check('x+25',after,n=>n.value==='5',n=>n.value==='5');});
test('fraction line and function/text glyph offsets survive insertion',()=>{check('\\frac{x}{y}','a+\\frac{x+1}{y}',n=>n.type==='frac',n=>n.type==='frac');for(const before of ['\\sin x','\\text{test}'])check(before,'a+'+before,n=>n.type==='char',n=>n.type==='char'&&n.start>2);});
test('explicit caret distinguishes repeated characters when inserting at the front',()=>{check('xx','xxx',n=>n.start===0&&n.type==='char',n=>n.start===1&&n.type==='char',{start:0,end:0});});
test('deleted glyph edits are not reassigned to a new node with the same serial ID',()=>{assert.deepEqual(remapEdits('x+y','y',parse('x+y'),parse('y'),{n0:{x:30}}),{});});
