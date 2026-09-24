// Font bytes stay on this device; nothing is uploaded.
export async function fontId(label){
  const name=label.toLowerCase().replace(/[\s_-]/g,'');
  const aliases={ceol:'ceol',ceolregular:'ceol',ceolitalic:'ceol-italic',ceolbold:'ceol-bold',timesnewroman:'times',euclid:'euclid',euclidregular:'euclid',euclidsymbol:'euclid-symbol',euclidsymbolregular:'euclid-symbol',euclidsymbolbold:'euclid-symbol-bold'};
  if(aliases[name])return aliases[name];
  if(/kozminpro.*regular/.test(name))return 'fallback';
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(label.toLowerCase()));
  return 'system:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);
}
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('ceol-local-fonts',1);r.onupgradeneeded=()=>r.result.createObjectStore('fonts',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function savedFonts(){const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('fonts').objectStore('fonts').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function saveFont(entry){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('fonts','readwrite');tx.objectStore('fonts').put(entry);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
