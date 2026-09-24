import test from 'node:test';import assert from 'node:assert/strict';
import {mapNamedSymbols} from '../dist/font-symbols.js';import {validateProject} from '../dist/engine.js';
test('symbol-font private-use glyphs acquire Unicode mappings without replacing existing glyphs',()=>{
  const map={43:99},names=['.notdef','integral','summation','plus','infinity'];const font={tables:{cmap:{glyphIndexMap:map}},glyphs:{length:names.length,get:i=>({name:names[i]})}};
  assert.equal(mapNamedSymbols(font),font);assert.equal(map[0x222b],1);assert.equal(map[0x2211],2);assert.equal(map[0x221e],4);assert.equal(map[43],99);
});
test('Euclid symbol choice is preserved in saved projects and old Times data is supported',()=>{
  const p={app:'ceol-formula-studio',version:1,layoutVersion:2,source:'x+1',font:'ceol-italic',fontSize:28,padding:12,color:'#000000',background:'#ffffff',transparent:true,edits:{}};
  for(const symbolFont of ['euclid','times'])assert.equal(validateProject({...p,symbolFont}).symbolFont,symbolFont);
});
