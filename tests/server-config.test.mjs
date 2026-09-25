import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {loadApiSettings,validateApiSettings} from '../server-config.mjs';

test('fixed API config is validated and the key never needs to enter the renderer',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'ceol-api-'));
  try{
    const file=path.join(directory,'api-settings.json');
    await writeFile(file,JSON.stringify({provider:'gemini',model:'gemini-test',key:'secret-test-key'}));
    assert.deepEqual(await loadApiSettings([path.join(directory,'missing.json'),file]),{provider:'gemini',model:'gemini-test',key:'secret-test-key',file});
    assert.throws(()=>validateApiSettings({provider:'other',model:'x',key:'secret-test-key'}));
    assert.throws(()=>validateApiSettings({provider:'openai',model:'bad model',key:'secret-test-key'}));
  }finally{await rm(directory,{recursive:true,force:true});}
});
