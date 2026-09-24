import {mkdir,copyFile,readFile} from 'node:fs/promises';
await mkdir('dist/fonts',{recursive:true});await mkdir('dist/vendor',{recursive:true});
// Fonts are intentionally not copied or distributed. Use installed PC fonts.
await copyFile('node_modules/opentype.js/dist/opentype.min.js','dist/vendor/opentype.min.js');
await copyFile('node_modules/opentype.js/LICENSE','dist/vendor/opentype-LICENSE.txt');
const html=await readFile('dist/index.html','utf8');for(const m of html.matchAll(/(?:src|href)="([^"#:]+)"/g)){if(!m[1].startsWith('data:')&&m[1]!=='./')await readFile('dist/'+m[1]);}
console.log('Static app ready in dist/; assets verified.');
