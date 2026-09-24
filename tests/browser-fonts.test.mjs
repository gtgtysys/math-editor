import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fontId} from '../dist/browser-fonts.js';
test('browser font IDs match desktop projects including symbol aliases',async()=>{
  for(const [label,id] of [['Ceol Italic','ceol-italic'],['Euclid Symbol','euclid-symbol'],['Euclid Symbol Bold','euclid-symbol-bold'],['Times New Roman','times']])assert.equal(await fontId(label),id);
  const label='Example Italic';assert.equal(await fontId(label),'system:'+createHash('sha256').update(label.toLowerCase()).digest('hex').slice(0,24));
});
