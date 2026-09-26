import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {scanFonts,fontName,extractTtcFaces,readInstalledFont} from '../server-fonts.mjs';import {testFont} from './test-font.mjs';
test('font catalog exposes stable IDs and labels without accepting arbitrary paths',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ceol-font-test-'));
  try{const bytes=Buffer.from(testFont('test-font-does-not-exist').toArrayBuffer());await writeFile(path.join(dir,'sample.ttf'),bytes);await writeFile(path.join(dir,'broken.otf'),'not a font');await writeFile(path.join(dir,'private.txt'),'not a font');const catalog=await scanFonts([dir]);assert.equal(catalog.size,1);const entry=[...catalog.values()][0];assert.match(entry.id,/^system:[a-f0-9]{24}$/);assert.match(entry.label,/Ceol Test Geometry/);assert.equal(fontName(bytes,'fallback'),entry.label);assert.equal((await scanFonts([dir])).keys().next().value,entry.id);await assert.rejects(readInstalledFont('../../private.txt'));}finally{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('ceol-font-test-'));await rm(dir,{recursive:true,force:true});}
});
test('TrueType collections expose each face as an ordinary OpenType font',()=>{
  const originals=['MS P Mincho','MS P Gothic'].map(name=>Buffer.from(testFont(name).toArrayBuffer()));
  const headerSize=12+originals.length*4;let cursor=headerSize;const chunks=[];
  for(const original of originals){const copy=Buffer.from(original),tableCount=copy.readUInt16BE(4);for(let i=0;i<tableCount;i++){const record=12+i*16;copy.writeUInt32BE(copy.readUInt32BE(record+8)+cursor,record+8);}chunks.push({offset:cursor,copy});cursor+=copy.length;}
  const ttc=Buffer.alloc(cursor);ttc.write('ttcf',0,'ascii');ttc.writeUInt32BE(0x00010000,4);ttc.writeUInt32BE(chunks.length,8);chunks.forEach(({offset,copy},index)=>{ttc.writeUInt32BE(offset,12+index*4);copy.copy(ttc,offset);});
  const extracted=extractTtcFaces(ttc);assert.equal(extracted.length,2);
  assert.deepEqual(extracted.map(face=>fontName(face,'missing')),['Ceol Test Geometry Regular','Ceol Test Geometry Regular']);
  assert.ok(extracted.every(face=>face.readUInt32BE(12+8)<face.length));
});
