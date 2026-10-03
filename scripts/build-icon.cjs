// Run with sharp installed or available through NODE_PATH.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
 const svg=fs.readFileSync(path.join(root,'icons/made.svg'));
 const frames=[];
 for(const size of [16,24,32,48,64,128,256]){
  const img=sharp(svg).resize(size,size),raw=await img.clone().ensureAlpha().raw().toBuffer();
  for(const p of [0,size-1,size*(size-1),size*size-1])if(raw[p*4+3]!==0)throw Error(`Opaque corner at ${size}px`);
  frames.push({size,png:await img.png().toBuffer()});
 }
 const header=Buffer.alloc(6+16*frames.length);header.writeUInt16LE(1,2);header.writeUInt16LE(frames.length,4);let offset=header.length;
 frames.forEach(({size,png},i)=>{const p=6+i*16;header[p]=header[p+1]=size===256?0:size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);header.writeUInt32LE(offset,p+12);offset+=png.length;});
 fs.writeFileSync(path.join(root,'build/icon.ico'),Buffer.concat([header,...frames.map(f=>f.png)]));
 fs.writeFileSync(path.join(root,'build/icon.svg'),svg);
 await sharp(svg).resize(512,512).png().toFile(path.join(root,'icons/made.png'));
 console.log('made.svg applied; seven ICO sizes have transparent corners.');
})().catch(e=>{console.error(e);process.exitCode=1});
