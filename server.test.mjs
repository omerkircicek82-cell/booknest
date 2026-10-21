import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

test('HTTP site, authentication, model status and streamed chat',async()=>{
  let received;
  const mock=http.createServer(async(req,res)=>{
    if(req.url==='/api/tags'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({models:[{name:'deepseek-r1:latest'}]}));}
    let body='';for await(const chunk of req)body+=chunk;
    const data=JSON.parse(body);received=data;assert.equal(data.model,'deepseek-r1');assert.equal(data.messages.find(m=>m.role==='user').content,'Merhaba');
    res.setHeader('Content-Type','application/x-ndjson');res.write(JSON.stringify({message:{thinking:'Düşünce',content:''},done:false})+'\n');res.end(JSON.stringify({message:{content:'Merhaba!'},done:true})+'\n');
  });
  mock.listen(0,'127.0.0.1');await once(mock,'listening');
  const reservation=http.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const child=spawn(process.execPath,['server.mjs'],{cwd:import.meta.dirname,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),OLLAMA_URL:`http://127.0.0.1:${mock.address().port}`,OLLAMA_MODEL:'deepseek-r1',ACCESS_PASSWORD:'test-password'},stdio:['ignore','pipe','pipe']});
  try {
    await Promise.race([once(child.stdout,'data'),new Promise((_,reject)=>setTimeout(()=>reject(new Error('startup timeout')),5000).unref())]);
    const url=`http://127.0.0.1:${port}`;const headers={'Authorization':'Bearer test-password','Content-Type':'application/json'};
    const page=await fetch(url);assert.equal(page.status,200);assert.match(await page.text(),/Düşüncelerine/);
    for(const path of ['/app.js','/style.css'])assert.equal((await fetch(url+path)).status,200);
    assert.equal((await fetch(url+'/api/status')).status,401);
    assert.deepEqual(await (await fetch(url+'/api/status',{headers})).json(),{model:'deepseek-r1',ready:true});
    const reply=await fetch(url+'/api/chat',{method:'POST',headers,body:JSON.stringify({messages:[{role:'user',content:'Merhaba'}]})});assert.equal(reply.status,200);const lines=(await reply.text()).trim().split('\n').map(JSON.parse);assert.equal(lines[1].message.content,'Merhaba!');assert.equal(lines[1].done,true);
    assert.equal(received.messages.length,1);
    assert.equal((await fetch(url+'/eglence')).status,200);
    const fun=await fetch(url+'/api/chat',{method:'POST',headers,body:JSON.stringify({mode:'fun',messages:[{role:'user',content:'Merhaba'}]})});
    await fun.text();assert.equal(received.messages[0].role,'system');assert.match(received.messages[0].content,/aptülfettah oğulları/);
    assert.equal((await fetch(url+'/game')).status,200);
    const game=await fetch(url+'/api/chat',{method:'POST',headers,body:JSON.stringify({mode:'game',messages:[{role:'user',content:'Merhaba'}]})});
    await game.text();assert.match(received.messages[0].content,/yalnızca ipucu/);
    const won=await fetch(url+'/api/chat',{method:'POST',headers,body:JSON.stringify({mode:'game',messages:[{role:'user',content:'Merhaba'},{role:'user',content:' KÖYLÜ  MİLLETİN EFENDİSİDİR. '},{role:'user',content:'Merhaba'}]})});
    await won.text();assert.match(received.messages[0].content,/oyunu tamamladı/);assert.match(received.messages[0].content,/hitabını kullanma/);
    assert.equal((await fetch(url+'/api/chat',{method:'POST',headers,body:'{"messages":[]}'})).status,400);
    assert.equal((await fetch(url+'/api/chat',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:'{}'})).status,403);
    await new Promise(r=>mock.close(r));assert.equal((await fetch(url+'/api/status',{headers})).status,503);
  } finally {child.kill();mock.close();}
});
