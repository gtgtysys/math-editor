import {readFile} from 'node:fs/promises';

export function validateApiSettings(value){
  if(!value||!['gemini','openai'].includes(value.provider))throw Error('APIサービスはgeminiまたはopenaiを指定してください。');
  if(typeof value.model!=='string'||!/^[a-zA-Z0-9_.:/-]{1,120}$/.test(value.model))throw Error('APIモデル名が不正です。');
  if(typeof value.key!=='string'||value.key.length<8||value.key.length>500)throw Error('APIキーが不正です。');
  return {provider:value.provider,model:value.model,key:value.key};
}

export async function loadApiSettings(paths=[]){
  for(const file of paths){
    if(!file)continue;
    try{return {...validateApiSettings(JSON.parse(await readFile(file,'utf8'))),file};}
    catch(error){if(error?.code==='ENOENT')continue;throw Error(`API設定ファイルを確認してください（${file}）：${error.message}`);}
  }
  return null;
}
