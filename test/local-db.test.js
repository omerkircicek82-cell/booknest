'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {LocalDatabase}=require('../lib/local-db');
const book={source:'Kitapyurdu',id:'edition-karton',title:'Emare: Maske',author:'Aslı Arslan',isbn:'9786256372030',language:'tr',desc:'Türkçe kitap açıklaması',publisher:'İndigo',productUrl:'https://www.kitapyurdu.com/kitap/emare-maske/750641.html'};
function database(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'booknest-catalog-'));let db=new LocalDatabase(dir);t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});return {dir,get db(){return db;},reopen(){db.close();db=new LocalDatabase(dir);return db;}};}
test('gerçek SQLite dosyası metadata ve tanılamayı yeniden açıldığında korur; fiyatı saklamaz',t=>{
 const box=database(t);box.db.put([{...book,price:1,offers:[{price:1}],warnings:['secret']}]);box.db.log('metadata',book.title,'Kaynak HTTP 429');
 assert.equal(fs.readFileSync(path.join(box.dir,'catalog.sqlite')).subarray(0,16).toString(),'SQLite format 3\0');
 const db=box.reopen(),item=db.find(book.isbn)[0];assert.equal(item.desc,book.desc);assert.equal(item.local,true);assert.ok(item.cachedAt);assert.equal(item.price,undefined);assert.equal(item.offers,undefined);assert.equal(item.warnings,undefined);assert.equal(db.diagnostics()[0].message,'Kaynak HTTP 429');
});
test('ilk sorgu kaydedilir, sonraki sorgu ağ olmadan arşivden gelir, yenileme uzak kaynağı kullanır',async t=>{
 const {db}=database(t);let calls=0;const remote=async()=>{calls++;return {items:[{...book,desc:'Sürüm '+calls}],warnings:['Kota kontrolü']};};
 assert.equal((await db.lookup('Emare Maske',{author:book.author},remote)).fromCache,false);assert.equal(calls,1);
 const local=await db.lookup('Emare Maske',{author:book.author},()=>assert.fail('yerel kayıt varken ağ kullanılmamalı'));assert.equal(local.fromCache,true);assert.equal(local.local,true);assert.equal(local.items[0].desc,'Sürüm 1');assert.deepEqual(local.warnings,[]);
 assert.equal((await db.lookup(book.isbn,{},remote,true)).fromCache,false);assert.equal(calls,2);assert.equal(db.find(book.isbn)[0].desc,'Sürüm 2');assert.equal(db.status().count,1);
});
test('ISBN ile baskılar ayrılır; ISBN10 ve karşılığı olan ISBN13 aynı baskıdır',t=>{
 const {db}=database(t);db.put([book,{...book,id:'edition-ciltli',isbn:'9786256372047',title:'Emare: Maske (Ciltli)'},{...book,source:'Google Books',id:'physics',title:'Physics',author:'A. Writer',isbn:'0306406152',language:'en'}]);
 assert.equal(db.find('9786256372030').length,1);assert.equal(db.find('9786256372030')[0].id,'edition-karton');assert.equal(db.find('9786256372047')[0].id,'edition-ciltli');assert.equal(db.find('9780306406157',{language:'all'})[0].id,'physics');assert.equal(db.find('9780306406157').length,0);
});
test('yerel başlık/yazar/dil eleği ilgisiz sonuçları ve İngilizce baskıyı reddeder',t=>{
 const {db}=database(t);db.put([book,{...book,id:'en',isbn:'9786256372047',language:'en'},{...book,id:'other-author',isbn:'9786256372054',author:'Başka Yazar'},{...book,id:'other-title',isbn:'9786256372061',title:'Bambaşka Kitap'}]);
 assert.deepEqual(db.find('Emare Maske',{author:'Asli Arslan'}).map(x=>x.id),['edition-karton']);assert.equal(db.find('Emare Maske',{author:book.author,language:'all'}).length,2);assert.equal(db.find('İlgisiz Kitap').length,0);
});
test('ISBNsiz kaynak kimlikleri ayrı kalır, doğrudan ürün adresi başka kitabı döndürmez',t=>{
 const {db}=database(t);const url='https://www.kitapyurdu.com/kitap/baska/2.html';db.put([{...book,isbn:'',id:'record-1'},{...book,isbn:'',id:'record-2',productUrl:url}]);
 assert.equal(db.status().count,2);assert.equal(db.find(book.productUrl)[0].id,'record-1');assert.equal(db.find(url)[0].id,'record-2');assert.equal(db.find('https://www.dr.com.tr/kitap/baska/urunno=123').length,0);
 assert.throws(()=>db.find('https://attacker.example/kitap/test'),/ürün sayfası/);
});
test('çıplak site kartları arşivi doldurmaz ve uzaktan bilgi çekmeyi engellemez',async t=>{
 const {db}=database(t);assert.equal(db.put([{title:book.title,author:book.author,color:'#333'}],{manual:true}),0);
 let fetched=false;await db.lookup('Emare Maske',{},async()=>{fetched=true;return {items:[book],warnings:[]};});assert.equal(fetched,true);
 db.put([{title:'İkinci Kitap',author:'Bir Yazar',desc:'Elle yazılmış açıklama'}],{manual:true});assert.equal(db.find('İkinci Kitap')[0].source,'Elle girilen');
 db.put([{title:'Kapaklı Kitap',author:'Yazar',desc:'Açıklama',source:'Kaynak adı',id:'original-id',cover:'img/uploaded-cover.png'}],{manual:true});const manual=db.find('Kapaklı Kitap')[0];assert.equal(manual.cover,'img/uploaded-cover.png');assert.equal(manual.source,'Kaynak adı');assert.equal(manual.id,'original-id');assert.equal(manual.language,'');
});
test('tanılama en yeni 200 kayıtla sınırlıdır; sır ve ham yanıt saklanmaz, temizleme kitapları silmez',t=>{
 const {db}=database(t);db.put([book]);for(let i=0;i<205;i++)db.log('prices',book.title,'Kayıt '+i);
 let logs=db.diagnostics();assert.equal(logs.length,200);assert.equal(logs[0].message,'Kayıt 204');assert.equal(logs.at(-1).message,'Kayıt 5');
 db.log('metadata',book.title,'HTTP 403 https://user:password@www.dr.com.tr/kitap/x?token=supersecret password=topsecret Bearer abcdef');
 const text=JSON.stringify(db.diagnostics()[0]);assert.doesNotMatch(text,/user:|supersecret|topsecret|abcdef/);assert.match(text,/403/);
 db.log('metadata',book.title,'<html><body>private raw server response</body></html>');assert.doesNotMatch(db.diagnostics()[0].message,/private raw/);
 db.clearDiagnostics();assert.deepEqual(db.diagnostics(),[]);assert.equal(db.status().count,1);
});
test('uzak hata yönetici tanılamasına kaydolur; boş arama önbelleğe alınmaz',async t=>{
 const {db}=database(t);await assert.rejects(()=>db.lookup('Emare Maske',{},async()=>{throw Error('Kaynak HTTP 429');}),/429/);assert.match(db.diagnostics()[0].message,/429/);assert.equal(db.status().count,0);
 await db.lookup('Emare Maske',{},async()=>({items:[],warnings:['Eşleşme yok']}));assert.equal(db.status().count,0);assert.match(db.diagnostics()[0].message,/Eşleşme/);
});
