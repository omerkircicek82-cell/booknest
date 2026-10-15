'use strict';
const http=require('node:http'), fs=require('node:fs/promises'), path=require('node:path'), crypto=require('node:crypto');
const {lookupBooks,comparePrices,retailerFor}=require('./lib/catalog');
if(http.setGlobalProxyFromEnv)http.setGlobalProxyFromEnv();
const ROOT=__dirname, DATA=path.resolve(process.env.DATA_DIR||path.join(ROOT,'.data'));
const password=process.env.ADMIN_PASSWORD;
if(!password||password.length<12){console.error('ADMIN_PASSWORD en az 12 karakter olmalı. .env.example dosyasını inceleyin.');process.exit(1);}
const sessions=new Map(), failures=new Map(), cache=new Map(), pending=new Map();
const slug=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const contentPath=path.join(DATA,'content.json');
let saving=Promise.resolve();
async function content(){return JSON.parse(await fs.readFile(contentPath,'utf8'));}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req,max=1_000_000){let n=0,parts=[];for await(const part of req){n+=part.length;if(n>max){const e=new Error('İstek çok büyük');e.status=413;throw e;}parts.push(part);}return Buffer.concat(parts);}
function authenticated(req){const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('bn_session='))?.slice(11);const expires=sessions.get(token);if(!expires||expires<Date.now()){sessions.delete(token);return false;}return token;}
function sameOrigin(req){if(!req.headers.origin)return true;try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}}
function validate(d){
  if(!d||typeof d!=='object'||Array.isArray(d))throw new Error('Geçersiz içerik.');
  for(const k of ['site','texts','about'])if(!d[k]||typeof d[k]!=='object'||Array.isArray(d[k]))throw new Error(k+' eksik.');
  for(const k of ['books','series','journal','ritual','photos','quotes'])if(!Array.isArray(d[k]))throw new Error(k+' liste olmalı.');
  if(!Array.isArray(d.about.chips)||!Array.isArray(d.about.stats))throw new Error('Hakkında alanları eksik.');
  if(d.books.length>500)throw new Error('En fazla 500 kitap.');
  const seen=new Set();
  for(const b of d.books){
    if(!b||typeof b.title!=='string'||!b.title.trim()||!slug(b.title))throw new Error('Her kitabın adı olmalı.');
    if(seen.has(slug(b.title)))throw new Error('Kitap adları benzersiz olmalı: '+b.title);seen.add(slug(b.title));
    if(b.priceUrls!==undefined&&(!Array.isArray(b.priceUrls)||b.priceUrls.length>8||b.priceUrls.some(u=>typeof u!=='string'||!retailerFor(u))))throw new Error('Fiyat bağlantıları D&R, Kitapyurdu, BKM Kitap veya İdefix HTTPS ürün adresleri olmalı (en fazla 8).');
    for(const [k,v] of Object.entries(b))if(k!=='priceUrls'&&typeof v!=='string'&&typeof v!=='number'&&v!==null)throw new Error('Geçersiz kitap alanı: '+k);
  }
  const walk=o=>{if(!o||typeof o!=='object')return;for(const [k,v] of Object.entries(o)){if(typeof v==='object')walk(v);else if(typeof v==='string'&&/(url|src|cover|avatar|photo)$/i.test(k)&&v&&!/^https?:\/\//i.test(v)&&!/^img\/[a-zA-Z0-9_./ -]+$/.test(v))throw new Error('Geçersiz bağlantı: '+k);}};walk(d);
}
async function save(d){validate(d);const text=JSON.stringify(d,null,2);const task=saving.then(async()=>{await fs.copyFile(contentPath,path.join(DATA,'content.bak.json'));const tmp=path.join(DATA,'content.tmp');await fs.writeFile(tmp,text);await fs.rename(tmp,contentPath);cache.clear();});saving=task.catch(()=>{});return task;}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const pages=new Set(['index.html','kitap.html','admin.html','panel.html','admin.js','script.js','book.js','admin.css','style.css']);
async function handler(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  try{
    const u=new URL(req.url,'http://localhost');let route=u.pathname;if(route==='/save.ashx'){const action=u.searchParams.get('action');route=action==='content'?'/content.json':action==='books'?'/api/books':action==='prices'?'/api/prices':'/api/admin';}
    if(req.method==='POST'&&!sameOrigin(req))return reply(res,403,{ok:false,msg:'İstek kaynağı geçersiz.'});
    if(route==='/api/admin'){
      if(req.method!=='POST')return reply(res,405,{ok:false,msg:'POST gerekli.'});
      const action=u.searchParams.get('action');
      if(action==='login'){
        if(authenticated(req))return reply(res,200,{ok:true});
        if(!req.headers['x-admin-pass'])return reply(res,401,{ok:false,msg:'Giriş gerekli.'});
        const ip=req.socket.remoteAddress, f=failures.get(ip);
        if(f&&f.until>Date.now()&&f.count>=5)return reply(res,429,{ok:false,msg:'Çok fazla deneme. 10 dakika bekleyin.'});
        const given=String(req.headers['x-admin-pass']||'');
        const hash=x=>crypto.createHash('sha256').update(x).digest();
        if(!crypto.timingSafeEqual(hash(given),hash(password))){const count=f&&f.until>Date.now()?f.count+1:1;failures.set(ip,{count,until:Date.now()+600000});return reply(res,403,{ok:false,msg:'Şifre hatalı.'});}
        failures.delete(ip);const token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);
        res.setHeader('Set-Cookie','bn_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800'+(process.env.SECURE_COOKIE==='true'?'; Secure':''));return reply(res,200,{ok:true});
      }
      const token=authenticated(req);if(!token)return reply(res,401,{ok:false,msg:'Oturum süresi doldu. Yeniden giriş yapın.'});
      if(action==='logout'){sessions.delete(token);res.setHeader('Set-Cookie','bn_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return reply(res,200,{ok:true});}
      if(action==='save'){const d=JSON.parse((await body(req)).toString('utf8'));await save(d);return reply(res,200,{ok:true,msg:'Kaydedildi'});}
      if(action==='upload'){
        const type=req.headers['content-type'], ext={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'}[type];
        if(!ext) return reply(res,400,{ok:false,msg:'JPG, PNG veya WebP seçin.'});
        const b=await body(req,5*1024*1024);
        const valid=ext==='.jpg'?b[0]===255&&b[1]===216&&b[2]===255:ext==='.png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
        if(!valid)return reply(res,400,{ok:false,msg:'Geçersiz görsel.'});
        const name=crypto.randomUUID()+ext;await fs.writeFile(path.join(DATA,'img',name),b,{flag:'wx'});return reply(res,200,{ok:true,path:'img/'+name});
      }
      return reply(res,400,{ok:false,msg:'Bilinmeyen işlem.'});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return reply(res,405,{ok:false,msg:'Yöntem desteklenmiyor.'});
    if(route==='/api/books'){
      if(!authenticated(req))return reply(res,401,{ok:false,msg:'Giriş gerekli.'});
      const result=await lookupBooks(u.searchParams.get('q'),undefined,{title:u.searchParams.get('title')||'',author:u.searchParams.get('author')||'',isbn:u.searchParams.get('isbn')||'',language:u.searchParams.get('lang')==='all'?'all':'tr'});return reply(res,200,result);
    }
    if(route==='/api/prices'){
      const d=await content(),b=d.books.find(b=>slug(b.title)===u.searchParams.get('book'));
      if(!b)return reply(res,404,{ok:false,msg:'Kitap bulunamadı.'});
      const key=JSON.stringify([b.isbn,b.title,b.author,b.priceUrls,b.buyUrl]);let result=cache.get(key);
      if(!result||result.until<Date.now()){
        if(!pending.has(key))pending.set(key,comparePrices(b,{enabled:process.env.PRICE_FETCH_ENABLED!=='false'}).then(data=>{const entry={until:Date.now()+(data.offers.length?300000:30000),data};cache.set(key,entry);return entry;}).finally(()=>pending.delete(key)));
        result=await pending.get(key);
      }
      return reply(res,200,result.data);
    }
    if(route==='/content.json')return reply(res,200,await content());
    let name=decodeURIComponent(route.slice(1))||'index.html';let file;
    if(pages.has(name))file=path.join(ROOT,name);
    else if(/^img\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(name)){file=path.join(DATA,name);try{await fs.access(file);}catch{file=path.join(ROOT,name);}}
    else return reply(res,404,{ok:false,msg:'Bulunamadı.'});
    const b=await fs.readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:b);
  }catch(e){reply(res,e.status|| (e.code==='ENOENT'?404:400),{ok:false,msg:e.code==='ENOENT'?'Bulunamadı.':e.message});}
}
async function main(){await fs.mkdir(path.join(DATA,'img'),{recursive:true});try{await fs.access(contentPath);}catch{await fs.copyFile(path.join(ROOT,'content.json'),contentPath);}const server=http.createServer(handler);server.listen(Number(process.env.PORT||3000),process.env.HOST||'0.0.0.0',()=>console.log('Book Nest sunucusu port '+server.address().port+' üzerinde hazır.'));}
main().catch(e=>{console.error(e.message);process.exit(1);});
