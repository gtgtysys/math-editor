import fs from 'node:fs';
import opentype from 'opentype.js';
// Original geometric test glyphs allow CI to run without redistributing fonts.
export function testFont(file){
  if(!process.env.CEOL_TEST_SYNTHETIC&&fs.existsSync(file))return opentype.loadSync(file);
  const italic=/Italic/i.test(file),glyphs=[new opentype.Glyph({name:'.notdef',advanceWidth:500,path:new opentype.Path()})];
  const chars=new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+-−=<>±∓×÷·*()[]{}|,;:!∑∏∫∮√∞≤≥≠≈≡∈∉⊂∪∩→←⇒∂∇∀∃…⋯′αβγδεζηθικλμνξοπρστυφχψωΔΓΘΛΣΦΨΩℓℏ');
  for(const char of chars){const p=new opentype.Path(),bottom=/[gjpqy]/.test(char)?-160:0,top=char==='='?350:700,slant=italic?100:0;p.moveTo(30,bottom);p.lineTo(440,bottom);p.lineTo(440+slant,top);p.lineTo(30+slant,top);p.close();glyphs.push(new opentype.Glyph({name:char,unicode:char.codePointAt(0),advanceWidth:600,path:p}));}
  const font=new opentype.Font({familyName:'Ceol Test Geometry',styleName:italic?'Italic':'Regular',unitsPerEm:1000,ascender:800,descender:-200,glyphs});
  return opentype.parse(font.toArrayBuffer());
}
