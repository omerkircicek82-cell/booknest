const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtemp,readFile,writeFile,rm}=require('node:fs/promises');
const os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {LocalDatabase}=require('../lib/local-db');
const {DatabaseSync}=require('node:sqlite');
test('giriş → kayıt → yenileme → yeniden başlatma; erişim ve dosya koruması',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'booknest-test-'));const password=crypto.randomBytes(24).toString('hex');let child,base,cookie;
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,ADMIN_PASSWORD:password,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,PRICE_FETCH_ENABLED:'false'}});let output='',errors='';await new Promise((resolve,reject)=>{child.stderr.on('data',b=>{errors+=b;});child.once('error',reject);child.once('exit',c=>reject(Error('server exit '+c+' '+errors)));child.stdout.on('data',b=>{output+=b;const m=output.match(/port (\d+)/);if(m){base='http://127.0.0.1:'+m[1];resolve();}});});}
 async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
 const request=(url,options={})=>fetch(base+url,{...options,headers:{...(cookie?{cookie}:{}),...options.headers}});
 try{
  await start();
  for(const url of ['/api/diagnostics','/api/local-books','/save.ashx?action=diagnostics','/save.ashx?action=local-books'])assert.equal((await request(url)).status,401);
  assert.equal((await request('/save.ashx?action=diagnostics-clear',{method:'POST'})).status,401);
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
  for(const name of ['/.env','/server.js','/web.config','/content.bak.json','/.data/content.json','/.data/catalog.sqlite','/catalog.sqlite','/App_Data/catalog.db','/lib/local-db.js'])assert.equal((await request(name)).status,404);
  r=await request('/save.ashx?action=upload',{method:'POST',headers:{'Content-Type':'image/png'},body:'bad'});assert.equal(r.status,400);
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
  r=await request('/save.ashx?action=upload',{method:'POST',headers:{'Content-Type':'image/png'},body:image});assert.equal(r.status,200);const upload=await r.json();assert.equal((await request('/'+upload.path)).status,200);
  for(const authenticatedPrice of [true,false]){const savedCookie=cookie;if(!authenticatedPrice)cookie='';r=await request('/save.ashx?action=prices&book=emare-sarmasik');assert.equal(r.status,200);const prices=await r.json();assert.equal(prices.offers.length,0);assert.deepEqual(Object.keys(prices).sort(),['checkedAt','offers','scope','searches']);assert.doesNotMatch(JSON.stringify(prices),/kapalı|warnings|error|HTTP/);cookie=savedCookie;}
  let diagnostics=await (await request('/api/diagnostics')).json();assert.equal(diagnostics.database.kind,'SQLite');assert.equal(diagnostics.database.path,'.data/catalog.sqlite');assert.equal(diagnostics.database.count,1);assert.ok(diagnostics.entries.some(x=>x.category==='prices'&&x.message.includes('kapalı')));
  let local=await (await request('/save.ashx?action=local-books&q=Emare')).json();assert.equal(local.count,1);assert.equal(local.items[0].publisher,'Kalıcı Test Yayınevi');assert.equal(local.items[0].desc,'Güncellenen açıklama');
  local=await (await request('/save.ashx?action=books&q=Emare%20Sarmaşık&author=Aslı%20Arslan')).json();assert.equal(local.fromCache,true);assert.equal(local.local,true);assert.equal(local.items[0].desc,'Güncellenen açıklama');
  // Fail only the catalog write through a real SQLite trigger, after content.json
  // has been saved. A successful site save must remain a success with a warning.
  const lockedCatalog=new DatabaseSync(path.join(dir,'catalog.sqlite'));lockedCatalog.exec("CREATE TRIGGER test_archive_write_failure BEFORE INSERT ON catalog BEGIN SELECT RAISE(FAIL, 'TEST_ARCHIVE_WRITE_FAILURE'); END;");
  try{d.site.brand='Kaydı tamamlanan site';r=await request('/save.ashx?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.ok,true);assert.match(saved.warnings.join(' '),/içeriği kaydedildi/);assert.equal((await (await request('/content.json')).json()).site.brand,d.site.brand);diagnostics=await (await request('/api/diagnostics')).json();assert.ok(diagnostics.entries.some(x=>x.category==='database'&&x.message.includes('TEST_ARCHIVE_WRITE_FAILURE')));}
  finally{lockedCatalog.exec('DROP TRIGGER test_archive_write_failure');lockedCatalog.close();}
  await writeFile(path.join(dir,'content.json'),'PRIVATE_INTERNAL_SENTINEL');r=await request('/content.json');assert.equal(r.status,500);assert.doesNotMatch(JSON.stringify(await r.json()),/PRIVATE_INTERNAL|Unexpected|JSON/);
  r=await request('/save.ashx?action=prices&book=emare-sarmasik');assert.equal(r.status,500);assert.doesNotMatch(JSON.stringify(await r.json()),/PRIVATE_INTERNAL|Unexpected|JSON/);
  diagnostics=await (await request('/save.ashx?action=diagnostics')).json();assert.ok(diagnostics.entries.some(x=>x.category==='content'));assert.ok(diagnostics.entries.some(x=>/JSON|Unexpected/.test(x.message)));await writeFile(path.join(dir,'content.json'),JSON.stringify(d));
  assert.equal((await request('/save.ashx?action=diagnostics-clear',{method:'POST',headers:{Origin:'https://evil.example'}})).status,403);
  assert.equal((await request('/save.ashx?action=diagnostics-clear',{method:'POST'})).status,200);diagnostics=await (await request('/api/diagnostics')).json();assert.deepEqual(diagnostics.entries,[]);assert.equal(diagnostics.database.count,1);
  await stop();await start();assert.equal((await (await request('/content.json')).json()).books[0].desc,'Güncellenen açıklama');
  cookie='';assert.equal((await request('/api/local-books')).status,401);assert.equal((await request('/api/diagnostics')).status,401);
  r=await request('/save.ashx?action=login',{method:'POST',headers:{'X-Admin-Pass':password}});cookie=r.headers.get('set-cookie').split(';')[0];local=await (await request('/save.ashx?action=books&q=Emare%20Sarmaşık&author=Aslı%20Arslan')).json();assert.equal(local.fromCache,true);assert.equal(local.items[0].desc,'Güncellenen açıklama');
  cookie='';assert.equal((await request('/save.ashx?action=books&q=test')).status,401);
  for(let i=0;i<5;i++)assert.equal((await request('/save.ashx?action=login',{method:'POST',headers:{'X-Admin-Pass':'wrong'}})).status,403);
  assert.equal((await request('/save.ashx?action=login',{method:'POST',headers:{'X-Admin-Pass':'wrong'}})).status,429);
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
test('mevcut zengin kitap bilgisi ilk açılışta aktarılır; tekrar açılış yeni arşiv kaydını ezmez',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'booknest-seed-')),password=crypto.randomBytes(24).toString('hex');let child,base,cookie;
 const d=JSON.parse(await readFile(path.join(__dirname,'..','content.json'),'utf8'));d.books[0]={...d.books[0],desc:'Önceki kitap bilgisi',publisher:'Mevcut Yayınevi',source:'Google Books',id:'existing-volume',language:'tr'};await writeFile(path.join(dir,'content.json'),JSON.stringify(d));
 async function start(){child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,ADMIN_PASSWORD:password,PORT:'0',HOST:'127.0.0.1',DATA_DIR:dir,PRICE_FETCH_ENABLED:'false'}});let output='',errors='';await new Promise((resolve,reject)=>{child.stderr.on('data',b=>{errors+=b;});child.once('error',reject);child.once('exit',c=>reject(Error('server exit '+c+' '+errors)));child.stdout.on('data',b=>{output+=b;const m=output.match(/port (\d+)/);if(m){base='http://127.0.0.1:'+m[1];resolve();}});});const r=await fetch(base+'/save.ashx?action=login',{method:'POST',headers:{'X-Admin-Pass':password}});cookie=r.headers.get('set-cookie').split(';')[0];}
 async function stop(){if(!child||child.exitCode!==null)return;await new Promise(resolve=>{child.once('exit',resolve);child.kill();});}
 async function lookup(){return (await fetch(base+'/save.ashx?action=books&q='+encodeURIComponent(d.books[0].title),{headers:{cookie}})).json();}
 try{await start();let data=await lookup();assert.equal(data.fromCache,true);assert.equal(data.items[0].source,'Google Books');assert.equal(data.items[0].language,'tr');assert.equal(data.items[0].desc,'Önceki kitap bilgisi');
  await stop();const db=new LocalDatabase(dir);db.put([{...d.books[0],desc:'Daha yeni kaynak açıklaması'}]);db.close();await start();data=await lookup();assert.equal(data.fromCache,true);assert.equal(data.items[0].desc,'Daha yeni kaynak açıklaması');
 }finally{await stop();await rm(dir,{recursive:true,force:true});}
});
