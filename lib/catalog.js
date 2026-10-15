'use strict';
const RETAILERS = [
  {name:'D&R',host:'dr.com.tr',search:q=>'https://www.dr.com.tr/search?q='+q},
  {name:'Kitapyurdu',host:'kitapyurdu.com',search:q=>'https://www.kitapyurdu.com/index.php?route=product/search&filter_name='+q},
  {name:'BKM Kitap',host:'bkmkitap.com',search:q=>'https://www.bkmkitap.com/arama?q='+q},
  {name:'İdefix',host:'idefix.com',search:q=>'https://www.idefix.com/arama?q='+q}
];
function retailerFor(value){
  try { const u=new URL(value); return u.protocol==='https:' && !u.username && !u.password && (!u.port||u.port==='443') && (RETAILERS.find(r=>u.hostname===r.host||u.hostname==='www.'+r.host)||false); } catch { return false; }
}
const isbn=value=>String(value||'').replace(/[-\s]/g,'').toUpperCase();
const text=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
async function fetchLimited(url,options={}){
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(9000),redirect:'error'});
  if(!r.ok)throw new Error('Kaynak HTTP '+r.status);
  const reader=r.body.getReader(); let size=0; const chunks=[];
  try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new Error('Kaynak yanıtı çok büyük');chunks.push(Buffer.from(value));} }
  finally {await reader.cancel().catch(()=>{});}
  return Buffer.concat(chunks).toString('utf8');
}
async function lookupBooks(query,fetcher=fetchLimited){
  const q=String(query||'').trim();if(q.length<2||q.length>200)throw new Error('Kitap adı veya ISBN 2–200 karakter olmalı.');
  const clean=isbn(q), search=/^(\d{13}|\d{9}[\dX])$/.test(clean)?'isbn:'+clean:q;
  const outcomes=await Promise.allSettled([
    fetcher('https://www.googleapis.com/books/v1/volumes?maxResults=8&printType=books&q='+encodeURIComponent(search)).then(JSON.parse).then(j=>(j.items||[]).map(v=>{
      const i=v.volumeInfo||{}, ids=i.industryIdentifiers||[];
      return {source:'Google Books',id:v.id,title:i.title||'',author:(i.authors||[]).join(', '),desc:text(i.description),pages:i.pageCount?String(i.pageCount):'',publisher:i.publisher||'',year:(i.publishedDate||'').slice(0,4),isbn:(ids.find(x=>x.type==='ISBN_13')||ids[0]||{}).identifier||'',cover:((i.imageLinks||{}).thumbnail||'').replace(/^http:/,'https:')};
    })),
    fetcher('https://openlibrary.org/search.json?limit=8&fields=key,title,author_name,isbn,publisher,first_publish_year,number_of_pages_median,cover_i&q='+encodeURIComponent(q)).then(JSON.parse).then(j=>(j.docs||[]).map(i=>({source:'Open Library',id:i.key,title:i.title||'',author:(i.author_name||[]).join(', '),desc:'',pages:i.number_of_pages_median?String(i.number_of_pages_median):'',publisher:(i.publisher||[])[0]||'',year:String(i.first_publish_year||''),isbn:(i.isbn||[]).find(x=>x.length===13)||(i.isbn||[])[0]||'',cover:i.cover_i?'https://covers.openlibrary.org/b/id/'+i.cover_i+'-L.jpg':''})))
  ]);
  const results=outcomes.flatMap(o=>o.status==='fulfilled'?o.value:[]);
  if(!results.length&&outcomes.every(o=>o.status==='rejected'))throw new Error('Kitap kaynaklarına ulaşılamadı. Ağ erişimini kontrol edin veya bilgileri elle girin.');
  const seen=new Set();return {items:results.filter(b=>{const key=b.isbn||b.title+'|'+b.author;if(seen.has(key))return false;seen.add(key);return true;}),warnings:outcomes.flatMap((o,i)=>o.status==='rejected'?[(i?'Open Library':'Google Books')+' şu anda kullanılamıyor.']:[])};
}
function parsePrice(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>0&&value<1e7?value:null;
  const s=String(value||'').trim();if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;
  const n=Number(s);return n>0&&n<1e7?n:null;
}
function extractOffer(html,book){
  const products=[];
  const visit=o=>{if(!o||typeof o!=='object')return;if(Array.isArray(o)){o.forEach(visit);return;}const types=[o['@type']].flat();if(types.includes('Product')||types.includes('Book'))products.push(o);if(o['@graph'])visit(o['@graph']);if(o.mainEntity)visit(o.mainEntity);};
  for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]));}catch{}}
  const expected=isbn(book.isbn);
  if(!/^(\d{13}|\d{9}[\dX])$/.test(expected))return null;
  const matches=products.filter(p=>[p.isbn,p.gtin13,p.gtin,p.gtin14].some(v=>isbn(v)===expected));
  const offers=matches.flatMap(p=>[p.offers||[]].flat()).filter(o=>o&&(!o['@type']||o['@type']==='Offer'));
  const valid=offers.filter(o=>o.priceCurrency==='TRY'&&/^(https?:\/\/schema.org\/)?InStock$/.test(o.availability||'')).map(o=>({price:parsePrice(o.price),shipping:null})).filter(o=>o.price!==null);
  return valid.sort((a,b)=>a.price-b.price)[0]||null;
}
async function comparePrices(book,{fetcher=fetchLimited,enabled=true}={}){
  const q=encodeURIComponent(book.isbn||[book.title,book.author].filter(Boolean).join(' '));
  const searches=RETAILERS.map(r=>({store:r.name,url:r.search(q)}));
  const links=[...new Set([...(book.priceUrls||[]),...(book.buyUrl?[book.buyUrl]:[])])].filter(retailerFor).slice(0,8);
  const offers=[], warnings=[];
  if(enabled)await Promise.all(links.map(async url=>{const store=retailerFor(url).name;try{
    const result=extractOffer(await fetcher(url),book);
    if(result)offers.push({store,url,...result,currency:'TRY',checkedAt:new Date().toISOString()});
    else warnings.push(store+': aynı ISBN için stokta ve TRY cinsinden doğrulanabilir fiyat bulunamadı.');
  }catch{warnings.push(store+': satıcı sayfası okunamadı.');}}));
  else warnings.push('Canlı fiyat okuma kapalı.');
  offers.sort((a,b)=>a.price-b.price);
  return {offers,searches,warnings,checkedAt:new Date().toISOString(),scope:'Tanımlı satıcı bağlantılarında aynı ISBN için doğrulanabilen ürün fiyatları. Kargo dahil değildir.'};
}
module.exports={RETAILERS,retailerFor,lookupBooks,extractOffer,comparePrices,fetchLimited};
