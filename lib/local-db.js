'use strict';
// Metadata and diagnostic history are private, durable data. Prices are deliberately
// excluded: a stored catalog entry must never make an old offer look current.
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {retailerFor}=require('./catalog');
const normalize=value=>String(value||'').replace(/<[^>]*>/g,' ').toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const isbn=value=>String(value||'').replace(/[-\s]/g,'').toUpperCase();
const isIsbn=value=>/^(\d{13}|\d{9}[\dX])$/.test(isbn(value));
function editionKey(value){let n=isbn(value);if(n.length===10){n='978'+n.slice(0,9);n+=String((10-[...n].reduce((sum,d,i)=>sum+Number(d)*(i%2?3:1),0)%10)%10);}return n;}
function language(value){const n=normalize(value);return /^(tr|tur|turkish|turkce|tr tr)$/.test(n)?'tr':/^(en|eng|english|en us|en gb)$/.test(n)?'en':n.split(' ')[0]||'';}
function safeUrl(value){try{const u=new URL(String(value||''));if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';u.hash='';for(const key of [...u.searchParams.keys()])if(/token|secret|password|api.?key|auth|^utm_|^ref$/i.test(key))u.searchParams.delete(key);return u.href;}catch{return '';}}
function diagnosticMessage(value){
  let text=String(value||'Bilinmeyen hata');
  if(/<!doctype|<html|<body|<script|^\s*[\[{][\s\S]{200}/i.test(text))return 'Kaynak geçersiz bir yanıt döndürdü.';
  text=text.replace(/https?:\/\/[^\s<>"']+/gi,raw=>{try{const u=new URL(raw);return u.origin.replace(/\/\/[^/]*@/,'//')+u.pathname;}catch{return '[adres]';}})
    .replace(/\b(?:bearer|basic)\s+[a-z\d+/=._-]+/gi,'[gizlendi]')
    .replace(/\b(password|passwd|token|api[_-]?key|secret|authorization|cookie|bn_session)\b\s*[:=]\s*[^\s,;]+/gi,'$1=[gizlendi]')
    .replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  return text.slice(0,1000)||'Bilinmeyen hata';
}
function metadata(value,{manual=false}={}){
  if(!value||typeof value!=='object')return null;
  const text=(key,max=400)=>typeof value[key]==='string'?value[key].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,max):typeof value[key]==='number'?String(value[key]):'';
  const item={source:text('source',80)||(manual?'Elle girilen':'Katalog'),id:text('id',2000),title:text('title'),author:text('author'),desc:text('desc',30000),pages:text('pages',20),publisher:text('publisher'),year:text('year',20),isbn:isIsbn(value.isbn)?isbn(value.isbn):'',cover:/^img\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(value.cover||'')?value.cover:safeUrl(value.cover),language:language(value.language)};
  if(!item.title||!normalize(item.title))return null;
  // A title-only site card is not a collected record and must not block discovery.
  if(!item.isbn&&!item.desc&&!item.pages&&!item.publisher&&!item.year&&!item.cover)return null;
  for(const key of ['sourceUrl','productUrl']){const url=safeUrl(value[key]);if(url&&retailerFor(url))item[key]=url;}
  if(manual&&!item.id)item.id='manual:'+normalize(item.title)+'|'+normalize(item.author);
  if(/^https?:\/\//i.test(item.id))item.id=safeUrl(item.id);
  if(!item.isbn&&!item.id&&!item.sourceUrl&&!item.productUrl)return null;
  return item;
}
function contextFor(query,provided={}){
  const q=String(query||'').trim(),direct=/^https?:\/\//i.test(q);
  if(q.length<2||q.length>(direct?2000:200))throw new Error('Kitap adı/ISBN 2–200 veya satıcı ürün adresi en fazla 2000 karakter olmalı.');
  if(direct){const r=retailerFor(q),u=r&&new URL(q);if(!r||!r.product(u.pathname))throw new Error('Desteklenen mağazanın ürün sayfası adresini girin.');}
  return {title:String(provided.title||(!direct&&!isIsbn(q)?q:'')),author:String(provided.author||''),isbn:isIsbn(provided.isbn)?isbn(provided.isbn):!direct&&isIsbn(q)?isbn(q):'',language:provided.language==='all'?'all':'tr',url:direct?safeUrl(q):''};
}
function similarity(expected,actual){const a=normalize(expected).split(' ').filter(Boolean),b=new Set(normalize(actual).split(' ').filter(Boolean));return a.length?a.filter(x=>b.has(x)).length/a.length:1;}
function rank(item,context){
  if(context.language!=='all'&&item.language&&item.language!=='tr')return -1;
  if(context.url&&!['id','productUrl','sourceUrl'].some(key=>{const url=safeUrl(item[key]);if(!url)return false;const a=new URL(url),b=new URL(context.url);return a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')&&a.pathname===b.pathname&&a.search===b.search;}))return -1;
  if(context.isbn)return editionKey(item.isbn)===editionKey(context.isbn)?110:-1;
  const title=similarity(context.title,item.title),author=similarity(context.author,item.author);
  if(context.title&&(title<0.67||similarity(item.title,context.title)<0.35))return -1;
  if(context.author&&author<0.67)return -1;
  return title*60+author*25+(item.language==='tr'?10:0)+(item.isbn?3:0);
}
class LocalDatabase{
  constructor(directory){
    fs.mkdirSync(directory,{recursive:true});this.file=path.join(directory,'catalog.sqlite');this.db=new DatabaseSync(this.file);this.fallbackDiagnostics=[];
    this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS catalog (record_key TEXT PRIMARY KEY, edition TEXT NOT NULL, source_identity TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL); CREATE INDEX IF NOT EXISTS catalog_edition ON catalog(edition); CREATE TABLE IF NOT EXISTS diagnostics (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, category TEXT NOT NULL, book TEXT NOT NULL, message TEXT NOT NULL);');
    fs.chmodSync(this.file,0o600);
  }
  close(){this.db.close();}
  put(items,options={}){
    const statement=this.db.prepare('INSERT INTO catalog(record_key,edition,source_identity,payload,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(record_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at');let count=0;
    this.db.exec('BEGIN');try{for(const value of items||[]){const item=metadata(value,options);if(!item)continue;const identity=item.source+'|'+(item.productUrl||item.sourceUrl||item.id),edition=item.isbn?editionKey(item.isbn):'',key=JSON.stringify([edition,identity]);statement.run(key,edition,identity,JSON.stringify(item),new Date().toISOString());count++;}this.db.exec('COMMIT');}catch(error){this.db.exec('ROLLBACK');throw error;}return count;
  }
  records(){return this.db.prepare('SELECT payload,updated_at FROM catalog ORDER BY updated_at DESC,record_key').all().map(row=>({...JSON.parse(row.payload),cachedAt:row.updated_at,local:true}));}
  seed(items){
    if(this.status().count)return 0;
    return this.put((items||[]).map(item=>({...item,source:item.source||'Önceki kayıt',id:item.id||'seed:'+normalize(item.title)+'|'+normalize(item.author)})));
  }
  find(query,provided={}){
    const context=contextFor(query,provided),seen=new Set();
    return this.records().map(item=>({item,rank:rank(item,context)})).filter(x=>x.rank>=0).sort((a,b)=>b.rank-a.rank).map(x=>x.item).filter(item=>{const key=item.isbn?'isbn:'+editionKey(item.isbn):item.source+'|'+item.id+'|'+(item.productUrl||item.sourceUrl||'');if(seen.has(key))return false;seen.add(key);return true;}).slice(0,16);
  }
  list(query=''){
    const q=normalize(String(query).slice(0,200)),all=this.records().filter(item=>!q||normalize([item.title,item.author,item.isbn,item.publisher].join(' ')).includes(q));return {items:all.slice(0,100),count:all.length};
  }
  status(){return {kind:'SQLite',count:this.db.prepare('SELECT COUNT(*) AS count FROM catalog').get().count,path:'.data/catalog.sqlite'};}
  log(category,book,message){
    const entry={createdAt:new Date().toISOString(),category:diagnosticMessage(category).slice(0,40),book:book?diagnosticMessage(book).slice(0,200):'',message:diagnosticMessage(message)};
    try{this.db.prepare('INSERT INTO diagnostics(created_at,category,book,message) VALUES(?,?,?,?)').run(entry.createdAt,entry.category,entry.book,entry.message);this.db.exec('DELETE FROM diagnostics WHERE id NOT IN (SELECT id FROM diagnostics ORDER BY id DESC LIMIT 200)');}
    catch(error){this.fallbackDiagnostics.unshift({...entry,id:'memory-'+Date.now()+'-'+this.fallbackDiagnostics.length},{...entry,id:'database-'+Date.now(),category:'database',message:'Tanılama kaydı yazılamadı: '+diagnosticMessage(error.message)});this.fallbackDiagnostics.length=Math.min(this.fallbackDiagnostics.length,200);}
  }
  diagnostics(){let saved=[];try{saved=this.db.prepare('SELECT id,created_at AS createdAt,category,book,message FROM diagnostics ORDER BY id DESC LIMIT 200').all();}catch(error){this.log('database','','Tanılama kayıtları okunamadı: '+error.message);}return [...this.fallbackDiagnostics,...saved].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||Number(b.id)-Number(a.id)).slice(0,200);}
  clearDiagnostics(){this.db.exec('DELETE FROM diagnostics');this.fallbackDiagnostics=[];}
  async lookup(query,provided={},remote,refresh=false){
    // Validate even cache hits, using the same retailer and matching constraints.
    contextFor(query,provided);
    if(!refresh){try{const items=this.find(query,provided);if(items.length)return {items,warnings:[],fromCache:true,local:true};}catch(error){this.log('database',provided.title||query,'Kitap arşivi okunamadı: '+error.message);}}
    let result;try{result=await remote(query,provided);}catch(error){this.log('metadata',provided.title||query,error.message);throw error;}
    try{this.put(result.items||[]);}catch(error){this.log('database',provided.title||query,'Kitap arşivine yazılamadı: '+error.message);result={...result,warnings:[...(result.warnings||[]),'Bilgiler alındı ancak yerel arşive kaydedilemedi. Yönetici tanılama kayıtlarını kontrol edin.']};}for(const warning of result.warnings||[])this.log('metadata',provided.title||query,warning);
    return {...result,fromCache:false,local:false};
  }
}
module.exports={LocalDatabase,diagnosticMessage};
