import test from 'node:test';
import assert from 'node:assert/strict';
import {parse,layout} from '../dist/engine.js';
import {fontPriority,isMathSymbol,isGreekLetter} from '../dist/editing.js';
import {testFont} from './test-font.mjs';

test('Greek letters are routed as Euclid symbols',()=>{
  for(const value of ['α','β','Ω','ϕ']){
    assert.equal(isGreekLetter(value),true);
    assert.equal(isMathSymbol(value),true);
  }
  assert.equal(isGreekLetter('x'),false);
});

test('named functions request the upright Ceol font role',()=>{
  const font=testFont('Ceol-Regular.ttf'),calls=[];
  layout(parse('\\exp x+\\log y+\\alpha'),32,(character,_override,role)=>{calls.push({character,role});return font;});
  for(const character of 'explog')assert.ok(calls.some(call=>call.character===character&&call.role==='upright'));
  assert.ok(calls.some(call=>call.character==='α'&&!call.role));
});

test('frequently used fonts sort before the rest',()=>{
  const labels=['Arial','ＭＳ Ｐゴシック','KozMinPro-Regular','ＭＳ Ｐ明朝','Euclid Regular','Ceol Bold','Ceol Italic','Ceol Regular'];
  assert.deepEqual(labels.sort((a,b)=>fontPriority(a)-fontPriority(b)),['Ceol Regular','Ceol Italic','Ceol Bold','Euclid Regular','ＭＳ Ｐ明朝','KozMinPro-Regular','ＭＳ Ｐゴシック','Arial']);
});

test('rendered glyphs expose the font name used by automatic routing',()=>{
  const font=testFont('Ceol-Regular.ttf'),result=layout(parse('x'),32,()=>font);
  assert.equal(result.items[0].fontNames.length,1);
  assert.match(result.items[0].fontNames[0],/Ceol.*Regular/);
});
