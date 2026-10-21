import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('Enter sends a new chat on HTTP where randomUUID is unavailable', async () => {
  const elements = new Map();
  const element = () => ({value:'',textContent:'',hidden:false,children:[],classList:{toggle(){}},append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},addEventListener(event,callback){this[event]=callback;},remove(){},focus(){}});
  const get = id => {if(!elements.has(id))elements.set(id,element());return elements.get(id);};
  const storage = new Map();let sent;
  const context = vm.createContext({
    document:{getElementById:get,createElement:element,querySelectorAll:()=>[]},
    localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    sessionStorage:{getItem:()=>null},crypto:{},AbortController,TextDecoder,
    fetch:async(url,options)=>{
      if(url==='/api/status')return {ok:true,status:200,json:async()=>({ready:true,model:'deepseek-r1'})};
      sent=JSON.parse(options.body);
      return {ok:true,body:new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"message":{"content":"Merhaba!"},"done":true}\n'));c.close();}})};
    }
  });
  vm.runInContext(await readFile(new URL('./public/app.js',import.meta.url),'utf8'),context);
  let submitted;
  get('composer').requestSubmit=()=>{submitted=get('composer').onsubmit({preventDefault(){}});};
  get('prompt').value='Merhaba';
  get('prompt').keydown({key:'Enter',preventDefault(){}});
  await submitted;
  assert.equal(sent.messages[0].content,'Merhaba');
  const chats=JSON.parse(storage.get('booknest-chats'));
  assert.match(chats[0].id,/^chat-/);
  assert.equal(chats[0].messages[1].content,'Merhaba!');
  assert.equal(get('error').textContent,'');
});
