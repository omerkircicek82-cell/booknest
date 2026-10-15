const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtemp,readFile,rm}=require('node:fs/promises');
const os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
test('giriş → kayıt → yenileme → yeniden başlatma; erişim ve dosya koruması',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'booknest-test-'));const password=crypto.randomBytes(24).toString('hex');let child,base,cookie;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,ADMIN_PASSWORD:password,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,PRICE_FETCH_ENABLED:'false'}});let output='';await new Promise((resolve,reject)=>{child.stderr.on('data',b=>reject(Error(String(b))));child.once('exit',c=>reject(Error('server exit '+c)));child.stdout.on('data',b=>{output+=b;const m=output.match(/port (\d+)/);if(m){base='http://127.0.0.1:'+m[1];resolve();}});});}
 async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
 const request=(url,options={})=>fetch(base+url,{...options,headers:{...(cookie?{cookie}:{}),...options.headers}});
 try{
  await start();
  let r=await request('/save.ashx?action=save',{method:'POST',body:'{}'});assert.equal(r.status,401);
  r=await request('/save.ashx?action=login',{method:'POST',headers:{'X-Admin-Pass':password}});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];assert.match(r.headers.get('set-cookie'),/HttpOnly/);
  r=await request('/save.ashx?action=login',{method:'POST'});assert.equal(r.status,200);
  const d=await (await request('/content.json')).json();d.books[0].publisher='Kalıcı Test Yayınevi';d.books[0].desc='Güncellenen açıklama';
  r=await request('/save.ashx?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});assert.equal(r.status,200);assert.equal((await r.json()).ok,true);
  assert.equal((await (await request('/content.json')).json()).books[0].publisher,'Kalıcı Test Yayınevi');
  assert.notEqual(JSON.parse(await readFile(path.join(dir,'content.bak.json'),'utf8')).books[0].publisher,'Kalıcı Test Yayınevi');
  r=await request('/save.ashx?action=save',{method:'POST',headers:{Origin:'https://evil.example'},body:JSON.stringify(d)});assert.equal(r.status,403);
  const bad=structuredClone(d);bad.books[0].priceUrls=['https://127.0.0.1/private'];r=await request('/save.ashx?action=save',{method:'POST',body:JSON.stringify(bad)});assert.equal(r.status,400);
  r=await request('/save.ashx?action=save',{method:'POST',body:'{bad'});assert.equal(r.status,400);
  for(const name of ['/.env','/server.js','/web.config','/content.bak.json','/.data/content.json'])assert.equal((await request(name)).status,404);
  r=await request('/save.ashx?action=upload',{method:'POST',headers:{'Content-Type':'image/png'},body:'bad'});assert.equal(r.status,400);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  r=await request('/save.ashx?action=upload',{method:'POST',headers:{'Content-Type':'image/png'},body:image});assert.equal(r.status,200);const upload=await r.json();assert.equal((await request('/'+upload.path)).status,200);
  r=await request('/save.ashx?action=prices&book=emare-sarmasik');assert.equal(r.status,200);assert.equal((await r.json()).offers.length,0);
  await stop();await start();assert.equal((await (await request('/content.json')).json()).books[0].desc,'Güncellenen açıklama');
  cookie='';assert.equal((await request('/save.ashx?action=books&q=test')).status,401);
  for(let i=0;i<5;i++)assert.equal((await request('/save.ashx?action=login',{method:'POST',headers:{'X-Admin-Pass':'wrong'}})).status,403);
  assert.equal((await request('/save.ashx?action=login',{method:'POST',headers:{'X-Admin-Pass':'wrong'}})).status,429);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
