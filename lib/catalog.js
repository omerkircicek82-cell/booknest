'use strict';
// Remote data is untrusted. Keep requests bounded and verify edition identity before pricing.
const RETAILERS = [
  {name:'D&R',host:'dr.com.tr',search:q=>'https://www.dr.com.tr/search?q='+q,product:p=>/^\/kitap\/[^?#]+/i.test(p)},
  {name:'Kitapyurdu',host:'kitapyurdu.com',search:q=>'https://www.kitapyurdu.com/index.php?route=product/search&filter_name='+q,product:p=>/^\/kitap\/[^?#]+/i.test(p)},
  {name:'BKM Kitap',host:'bkmkitap.com',search:q=>'https://www.bkmkitap.com/arama?q='+q,product:p=>p!=='/'&&!/^\/(arama|search|kategori|yazar|yayinevi|hesabim|sepet)(\/|$)/i.test(p)},
  {name:'İdefix',host:'idefix.com',search:q=>'https://www.idefix.com/arama?q='+q,product:p=>/\/(?:kitap|[^/]+-p-\d+)(?:\/|$)/i.test(p)}
];
function retailerFor(value){
  try { const u=new URL(value); return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(RETAILERS.find(r=>u.hostname===r.host||u.hostname==='www.'+r.host)||false); } catch { return false; }
}
const isbn=value=>String(value||'').replace(/[-\s]/g,'').toUpperCase();
const isIsbn=value=>/^(\d{13}|\d{9}[\dX])$/.test(isbn(value));
const editionKey=value=>{let n=isbn(value);if(n.length===10){n='978'+n.slice(0,9);n+=String((10-[...n].reduce((sum,d,i)=>sum+Number(d)*(i%2?3:1),0)%10)%10);}return n;};
function decode(value){return String(value||'').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp|lrm|rlm);/gi,(all,key)=>{const names={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',lrm:'',rlm:''};if(key[0]!=='#')return names[key.toLowerCase()]??all;const n=key[1].toLowerCase()==='x'?parseInt(key.slice(2),16):Number(key.slice(1));return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';});}
const cleanText=value=>decode(String(value||'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const arr=value=>value==null?[]:Array.isArray(value)?value:[value];
const normalize=value=>cleanText(value).toLocaleLowerCase('tr').replace(/ı/g,'i').normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function language(value){const s=normalize(String(value||'').split('/').at(-1));if(/^(tr|tur|turkish|turkce|tr tr)$/.test(s))return 'tr';if(/^(en|eng|english|en us|en gb)$/.test(s))return 'en';return s.split(' ')[0]||'';}
function apiAllowed(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&['www.googleapis.com','openlibrary.org'].includes(u.hostname);}catch{return false;}}
async function fetchLimited(url,options={}){
  const original=new URL(url),retailer=retailerFor(url);if(!retailer&&!apiAllowed(url))throw new Error('İzin verilmeyen kaynak adresi');
  let current=original;const signal=AbortSignal.timeout(9000);
  for(let hop=0;hop<=2;hop++){
    const response=await fetch(current,{...options,signal,redirect:'manual'});
    if(response.status>=300&&response.status<400){
      const location=response.headers.get('location');await response.body?.cancel();
      if(!location||hop===2)throw new Error('Yönlendirme sınırı veya geçersiz yönlendirme');
      const next=new URL(location,current);
      const same=retailer?retailerFor(next.href)?.host===retailer.host:apiAllowed(next.href)&&next.hostname===original.hostname;
      if(!same)throw new Error('Farklı kaynağa/güvensiz adrese yönlendirme reddedildi');current=next;continue;
    }
    if(!response.ok){await response.body?.cancel();throw new Error('Kaynak HTTP '+response.status);}
    if(Number(response.headers.get('content-length')||0)>2_000_000){await response.body?.cancel();throw new Error('Kaynak yanıtı çok büyük');}
    const reader=response.body.getReader();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new Error('Kaynak yanıtı çok büyük');chunks.push(Buffer.from(value));}}
    finally{await reader.cancel().catch(()=>{});}
    const bytes=Buffer.concat(chunks),head=bytes.subarray(0,4096).toString('ascii');
    const charset=(response.headers.get('content-type')||'').match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||head.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8';
    try{return new TextDecoder(charset).decode(bytes);}catch{return bytes.toString('utf8');}
  }
}
function parsePrice(value){
  if(typeof value==='number')return Number.isFinite(value)&&value>0&&value<1e7?value:null;
  let s=decode(value).trim().replace(/\s*(?:TL|TRY|₺)\s*$/i,'').replace(/^(?:TL|TRY|₺)\s*/i,'').replace(/[\s\u00a0]/g,'');
  if(/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');
  else if(/^\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(s))s=s.replace(/,/g,'');
  else if(/^\d+,\d{1,2}$/.test(s))s=s.replace(',','.');
  else if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;
  const n=Number(s);return n>0&&n<1e7?n:null;
}
function attributes(source){const result={};for(const m of source.matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))result[m[1].toLowerCase()]=decode(m[2]??m[3]??m[4]??'');return result;}
function documentNodes(html){
  const root={tag:'root',attrs:{},children:[]},stack=[root];const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  const tokens=String(html).match(/<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>|<[^>]+>|[^<]+/gi)||[];
  for(const token of tokens.slice(0,60000)){
    if(/^<!--|^<script\b|^<style\b/i.test(token))continue;
    if(/^<\//.test(token)){const tag=token.slice(2).match(/^\s*([^\s>]+)/)?.[1]?.toLowerCase();for(let i=stack.length-1;i>0;i--)if(stack[i].tag===tag){stack.length=i;break;}continue;}
    if(/^</.test(token)){const m=token.match(/^<\s*([\w:-]+)\b([\s\S]*?)\/?\s*>$/);if(!m)continue;const node={tag:m[1].toLowerCase(),attrs:attributes(m[2]),children:[]};stack.at(-1).children.push(node);if(!voids.has(node.tag)&&!token.endsWith('/>'))stack.push(node);}
    else stack.at(-1).children.push(token);
  }
  return root;
}
function descendants(node,predicate,result=[]){if(typeof node==='string')return result;if(predicate(node))result.push(node);for(const child of node.children)descendants(child,predicate,result);return result;}
function nodeText(node){return typeof node==='string'?node:node.children.map(nodeText).join(' ');}
function nodeValue(node){return node.attrs.content??node.attrs.value??node.attrs.href??node.attrs.src??cleanText(nodeText(node));}
function typeIs(value,name){return arr(value).some(v=>String(v).split(/[\/#]/).at(-1)===name);}
function fieldName(value){return arr(value).map(x=>typeof x==='object'?(x.name||''):x).filter(Boolean).join(', ');}
function productIsbn(product){
  const explicit=[product.isbn,product.gtin13,product.gtin,product.gtin14,product.gtin12].flatMap(arr).map(isbn).filter(isIsbn);
  if(explicit.length)return explicit;
  // Some shops use the book's ISBN as SKU. It cannot override an explicit, different ISBN.
  return arr(product.sku).map(isbn).filter(isIsbn);
}
function productObjects(html){
  const all=[],ids=new Map();
  function scan(value,depth=0){if(!value||typeof value!=='object'||depth>20)return;if(Array.isArray(value)){for(const x of value)scan(x,depth+1);return;}if(value['@id']&&Object.keys(value).length>1)ids.set(value['@id'],value);all.push(value);for(const x of Object.values(value))if(typeof x==='object')scan(x,depth+1);}
  for(const m of String(html).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){if((attributes(m[1]).type||'').toLowerCase()!=='application/ld+json')continue;try{scan(JSON.parse(m[2].replace(/^\s*<!--|-->\s*$/g,'')));}catch{}}
  function resolve(value,depth=0,seen=new Set()){
    if(!value||typeof value!=='object'||depth>12)return value;if(Array.isArray(value))return value.map(x=>resolve(x,depth+1,new Set(seen)));
    if(value['@id']&&ids.has(value['@id'])&&ids.get(value['@id'])!==value&&!seen.has(value['@id'])){seen.add(value['@id']);value={...ids.get(value['@id']),...value};}
    return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='@id'?v:resolve(v,depth+1,new Set(seen))]));
  }
  const products=all.filter(p=>typeIs(p['@type'],'Product')||typeIs(p['@type'],'Book')).map(p=>resolve(p));
  const doc=documentNodes(html);
  const scopes=descendants(doc,n=>/\b(?:Product|Book)\b/.test(n.attrs.itemtype||''));
  function properties(scope){
    const values={};function visit(node){if(typeof node==='string')return;if(node!==scope&&/\b(?:Product|Book)\b/.test(node.attrs.itemtype||''))return;
      for(const key of (node.attrs.itemprop||'').split(/\s+/).filter(Boolean)){
        let value=nodeValue(node);if(key==='offers'&&node.children.length)value=properties(node);else if(['author','publisher','brand'].includes(key)&&node.children.length){const names=descendants(node,n=>(n.attrs.itemprop||'').split(/\s+/).includes('name'));if(names.length)value={name:nodeValue(names[0])};}
        if(values[key]===undefined)values[key]=value;else values[key]=arr(values[key]).concat(value);
      }
      for(const child of node.children)visit(child);
    }visit(scope);return values;
  }
  for(const scope of scopes)products.push({...properties(scope),'@type':'Product'});
  const meta={};for(const n of descendants(doc,n=>n.tag==='meta')){const key=(n.attrs.property||n.attrs.name||n.attrs.itemprop||'').toLowerCase();if(key&&n.attrs.content&&!meta[key])meta[key]=n.attrs.content;}
  // Page-level fallbacks require explicit book/product metadata, never an arbitrary page heading.
  if(/(?:book|product)/i.test(meta['og:type']||'')||meta['book:isbn']||meta['product:isbn']){
    const p={'@type':'Product',name:meta['og:title']||meta['twitter:title'],isbn:meta['book:isbn']||meta['product:isbn'],sku:meta['product:retailer_item_id'],author:meta['book:author'],publisher:meta['book:publisher'],numberOfPages:meta['book:page_count'],description:meta['og:description']||meta.description,image:meta['og:image'],inLanguage:meta['book:language']||meta['og:locale'],url:meta['og:url']};
    if(meta['product:price:amount']||meta['og:price:amount'])p.offers={price:meta['product:price:amount']||meta['og:price:amount'],priceCurrency:meta['product:price:currency']||meta['og:price:currency'],availability:meta['product:availability']};products.push(p);
  }
  const link=descendants(doc,n=>n.tag==='link'&&(n.attrs.rel||'').split(/\s+/).includes('canonical'))[0];
  const pageUrl=meta['og:url']||link?.attrs.href;
  if(pageUrl){
    const identity=value=>{try{const u=new URL(String(value));u.hash='';u.search='';return u.href;}catch{return '';}};
    const canonical=identity(pageUrl),main=products.filter(p=>identity(p.url||p['@id'])===canonical);
    if(canonical&&main.length){const ids=main.flatMap(productIsbn);return {products:products.filter(p=>main.includes(p)||productIsbn(p).some(x=>ids.includes(x))),all};}
  }
  return {products,all};
}
function flattenOffers(value){return arr(value).flatMap(o=>o&&typeof o==='object'?(o.offers?flattenOffers(o.offers):[o]):[]);}
function offersFor(product){return flattenOffers(product.offers||(product.price!=null?product:[])).map(offer=>{
  const specification=arr(offer.priceSpecification).find(x=>x&&x.price!=null)||{};
  const price=parsePrice(offer.price??specification.price),currency=String(offer.priceCurrency||specification.priceCurrency||'').toUpperCase();
  const availability=String(offer.availability||product.availability||'').split(/[\/#]/).at(-1).toLowerCase();
  if(currency!=='TRY'||price===null||availability&& !['instock','limitedavailability','onlineonly','in stock','in_stock','available'].includes(availability))return null;
  return {price,shipping:null,stockStatus:availability?'available':'unknown'};
}).filter(Boolean);}
function inspectOffer(html,book){
  const expected=isbn(book.isbn);if(!isIsbn(expected))return {offer:null,reason:'Kitabın ISBN bilgisi eksik; aynı baskı doğrulanamaz.'};
  const {products}=productObjects(html);if(!products.length)return {offer:null,reason:'Ürün şeması/ürüne ait yapılandırılmış veri bulunamadı.'};
  const identified=products.filter(p=>productIsbn(p).length),matches=identified.filter(p=>productIsbn(p).some(id=>editionKey(id)===editionKey(expected)));
  if(!identified.length)return {offer:null,reason:'Satıcı ürününde doğrulanabilir ISBN bulunamadı.'};
  if(!matches.length)return {offer:null,reason:'Satıcı ürününün ISBN bilgisi seçili baskıyla eşleşmiyor.'};
  const offers=matches.flatMap(offersFor).sort((a,b)=>a.price-b.price);
  return offers.length?{offer:offers[0],reason:''}:{offer:null,reason:'Aynı ISBN için TRY fiyatı/stok bilgisi doğrulanamadı (ürün satışa kapalı olabilir).'};
}
function extractOffer(html,book){return inspectOffer(html,book).offer;}
function safeProductUrl(value,base,retailer){if(typeof value!=='string'||!value.trim())return null;try{const u=new URL(decode(value),base);if(retailerFor(u.href)?.host!==retailer.host||!retailer.product(u.pathname))return null;u.hash='';if(retailer.host==='kitapyurdu.com')u.search='';else for(const key of [...u.searchParams.keys()])if(/^(utm_|s_token$|s_time$|ref$)/i.test(key))u.searchParams.delete(key);return u.href;}catch{return null;}}
function discoverProducts(html,base,retailer,book={}){
  const candidates=[],{all}=productObjects(html);
  const add=value=>{const url=safeProductUrl(value,base,retailer);if(url&&!candidates.includes(url))candidates.push(url);};
  for(const product of all.filter(o=>typeIs(o['@type'],'Book')||typeIs(o['@type'],'Product')))if(!book.isbn||productIsbn(product).some(id=>editionKey(id)===editionKey(book.isbn)))add(product.url||product['@id']);
  for(const list of all.filter(o=>typeIs(o['@type'],'ItemList')))for(const entry of arr(list.itemListElement)){if(typeof entry==='string')add(entry);else if(entry){add(entry.url);if(typeof entry.item==='string')add(entry.item);else if(entry.item)add(entry.item.url||entry.item['@id']);}}
  for(const m of String(html).matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)){
    const attrs=attributes(m[1]),label=cleanText(m[2])||attributes(m[2].match(/<img\b([^>]*)>/i)?.[1]||'').alt||attrs.title||'';
    if(attrs.href&&(!book.title||similarity(book.title,label)>=0.67))add(attrs.href);if(candidates.length>=12)break;
  }
  return candidates.slice(0,3);
}
function similarity(expected,actual){const a=normalize(expected).split(' ').filter(Boolean),b=new Set(normalize(actual).split(' ').filter(Boolean));if(!a.length)return 1;return a.filter(token=>b.has(token)).length/a.length;}
function rankItem(item,context){
  if(context.language!=='all'&&item.language&&item.language!=='tr')return -1;
  if(context.isbn){if(editionKey(item.isbn)!==editionKey(context.isbn))return -1;return 100+(item.language==='tr'?10:0);}
  const title=similarity(context.title,item.title),author=similarity(context.author,item.author);
  if(context.title&&(title<0.67||similarity(item.title,context.title)<0.35))return -1;
  if(context.author&&author<0.67)return -1;
  return Math.round(title*60+author*25+(item.language==='tr'?10:0)+(item.isbn?3:0));
}
function rankItems(items,context){return items.map(item=>({item,rank:rankItem(item,context)})).filter(x=>x.rank>=0).sort((a,b)=>b.rank-a.rank).map(x=>x.item);}
function retailerMetadata(html,url){
  const retailer=retailerFor(url),{products}=productObjects(html);
  const items=products.filter(p=>p.name&&productIsbn(p).length).map((p,index)=>{
    const image=arr(p.image)[0];return {source:retailer.name,id:url+'#'+index,title:cleanText(p.name),author:cleanText(fieldName(p.author)),desc:cleanText(p.description),pages:p.numberOfPages?String(p.numberOfPages):'',publisher:cleanText(fieldName(p.publisher||p.brand)),year:String(p.datePublished||'').slice(0,4),isbn:productIsbn(p)[0],cover:typeof image==='string'?image:(image?.url||image?.contentUrl||''),language:language(typeof p.inLanguage==='object'?p.inLanguage.name||p.inLanguage.alternateName:p.inLanguage),sourceUrl:url,productUrl:url};
  });
  const merged=new Map();for(const item of items){if(!merged.has(item.isbn))merged.set(item.isbn,item);else{const existing=merged.get(item.isbn);for(const key of ['author','publisher','pages','year','desc','cover','language'])if(!existing[key]&&item[key])existing[key]=item[key];}}return [...merged.values()];
}
function googleItem(volume){const i=volume.volumeInfo||{},ids=i.industryIdentifiers||[];return {source:'Google Books',id:volume.id,title:i.title||'',author:(i.authors||[]).join(', '),desc:cleanText(i.description),pages:i.pageCount?String(i.pageCount):'',publisher:i.publisher||'',year:(i.publishedDate||'').slice(0,4),isbn:(ids.find(x=>x.type==='ISBN_13')||ids.find(x=>x.type==='ISBN_10')||{}).identifier||'',cover:((i.imageLinks||{}).thumbnail||'').replace(/^http:/,'https:'),language:language(i.language)};}
function sourceError(name,error){const message=error?.message||'Bilinmeyen erişim hatası';const help=/\b429\b/.test(message)?' Sorgu kotası/istek sınırı dolmuş; bu, kitabın bulunmadığı anlamına gelmez.':/\b403\b/.test(message)?' Kaynak sunucu bu isteği engelledi.':/\b511\b/.test(message)?' Kaynak erişimi reddetti.':'';return name+': '+message+'.'+help;}
async function lookupBooks(query,fetcher=fetchLimited,provided={}){
  const q=String(query||'').trim();if(q.length<2||q.length>2000)throw new Error('Kitap adı/ISBN 2–200 veya satıcı ürün adresi en fazla 2000 karakter olmalı.');
  const retailer=retailerFor(q),direct=/^https?:\/\//i.test(q);
  if(direct&&!retailer)throw new Error('Yalnızca D&R, Kitapyurdu, BKM Kitap ve İdefix HTTPS ürün adresleri kullanılabilir.');
  if(!direct&&q.length>200)throw new Error('Kitap adı veya ISBN en fazla 200 karakter olmalı.');
  const context={title:String(provided.title||(!direct&&!isIsbn(q)?q:'')),author:String(provided.author||''),isbn:isIsbn(provided.isbn)?isbn(provided.isbn):!direct&&isIsbn(q)?isbn(q):'',language:provided.language==='all'?'all':'tr'};
  if(retailer){
    if(!safeProductUrl(q,q,retailer))throw new Error('Mağazanın arama/kategori adresi yerine ürün sayfası adresini girin.');
    try{const items=rankItems(retailerMetadata(await fetcher(q),q),context);return {items,warnings:items.length?[]:[retailer.name+': ISBN, dil veya kitap/yazar eşleşmesi doğrulanamadı.']};}catch(error){throw new Error(sourceError(retailer.name,error));}
  }
  const warnings=[];let successful=0;
  async function google(){
    const base='https://www.googleapis.com/books/v1/volumes?maxResults=12&printType=books&country=TR'+(context.language==='all'?'':'&langRestrict=tr');
    const search=context.isbn?'isbn:'+context.isbn:'intitle:"'+context.title.replace(/"/g,'')+'"'+(context.author?' inauthor:"'+context.author.replace(/"/g,'')+'"':'');
    const run=async term=>{const data=JSON.parse(await fetcher(base+'&q='+encodeURIComponent(term)));if(data.error)throw new Error(data.error.message||'Kaynak API hatası');successful++;return rankItems((data.items||[]).map(googleItem),context);};
    let items=await run(search);
    if(!items.length&&!context.isbn&&context.author)items=await run('intitle:"'+context.title.replace(/"/g,'')+'"');
    return items;
  }
  async function openLibrary(){
    const base='https://openlibrary.org';let candidates=[];
    if(context.isbn)candidates=[{key:'/isbn/'+context.isbn}];
    else{
      const url=base+'/search.json?limit=4&fields=key,title,author_name,editions,editions.key,editions.language&lang=tr&q='+encodeURIComponent('title:"'+context.title.replace(/"/g,'')+'"'+(context.author?' author:"'+context.author.replace(/"/g,'')+'"':'')+(context.language==='all'?'':' language:tur'));
      const data=JSON.parse(await fetcher(url));successful++;
      for(const doc of data.docs||[]){if(similarity(context.title,doc.title)<0.67)continue;if(context.author&&similarity(context.author,(doc.author_name||[]).join(' '))<0.67)continue;
        // Work-level ISBN/publisher lists mix translations. Only inspect actual editions.
        for(const edition of (doc.editions?.docs||[])){const key=edition.key;if(/^\/books\/OL\d+M$/.test(key||''))candidates.push({key,authors:doc.author_name||[]});}
      }
      if(!candidates.length&&data.docs?.length)warnings.push('Open Library: Türkçe baskı kaydı bulunamadı; eser düzeyindeki karışık ISBN listeleri kullanılmadı.');
    }
    const items=[];
    for(const candidate of candidates.slice(0,4)){
      try{
        const edition=JSON.parse(await fetcher(base+candidate.key+'.json'));successful++;
        const langs=arr(edition.languages).map(x=>language(x?.key||x)),editionLang=langs.includes('tr')?'tr':langs[0]||'';
        if(context.language!=='all'&&editionLang&&editionLang!=='tr')continue;
        const ids=[...(edition.isbn_13||[]),...(edition.isbn_10||[])].map(isbn).filter(isIsbn),chosen=context.isbn?ids.find(x=>editionKey(x)===editionKey(context.isbn)):ids[0];if(context.isbn&&!chosen)continue;
        let authors=candidate.authors||[];
        if(!authors.length)for(const entry of arr(edition.authors).slice(0,2)){if(entry?.name)authors.push(entry.name);else if(/^\/authors\/OL\d+A$/.test(entry?.key||'')){try{const author=JSON.parse(await fetcher(base+entry.key+'.json'));if(author.name)authors.push(author.name);}catch{}}}
        const desc=typeof edition.description==='string'?edition.description:edition.description?.value;
        const date=String(edition.publish_date||'');items.push({source:'Open Library',id:edition.key||candidate.key,title:edition.title||'',author:authors.join(', '),desc:cleanText(desc),pages:edition.number_of_pages?String(edition.number_of_pages):'',publisher:(edition.publishers||[])[0]||'',year:date.match(/\b\d{4}\b/)?.[0]||'',isbn:chosen||'',cover:edition.covers?.[0]>0?'https://covers.openlibrary.org/b/id/'+edition.covers[0]+'-L.jpg':'',language:editionLang});
      }catch(error){warnings.push(sourceError('Open Library baskı',error));}
    }
    return rankItems(items,context);
  }
  const outcomes=await Promise.allSettled([google(),openLibrary()]);
  outcomes.forEach((o,i)=>{if(o.status==='rejected')warnings.push(sourceError(i?'Open Library':'Google Books',o.reason));});
  let results=rankItems(outcomes.flatMap(o=>o.status==='fulfilled'?o.value:[]),context);
  // Turkish retail editions fill catalog gaps without needing a paid API or guessing an edition.
  if(!results.length){
    const retailer=RETAILERS[1],search=retailer.search(encodeURIComponent(context.isbn||context.title));
    try{
      const html=await fetcher(search);successful++;
      const urls=discoverProducts(html,search,retailer,context);
      if(!urls.length)warnings.push(retailer.name+': arama sayfasında ürün bağlantısı bulunamadı.');
      for(const url of urls){try{results.push(...rankItems(retailerMetadata(await fetcher(url),url),context));}catch(error){warnings.push(sourceError(retailer.name,error));}}
    }catch(error){warnings.push(sourceError(retailer.name+' arama',error));}
  }
  results=rankItems(results,context);const seen=new Set();
  const items=results.filter(item=>{const key=item.isbn||normalize(item.title)+'|'+normalize(item.author);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,16);
  if(!items.length&&!successful)throw new Error('Kitap kaynaklarına ulaşılamadı. '+warnings.join(' ')+' Satıcı ürün bağlantısı veya elle bilgi girişi kullanılabilir.');
  if(!items.length)warnings.push('Aranan kitap/yazar ve Türkçe baskıyla eşleşen sonuç bulunamadı. Satıcı ürün bağlantısıyla deneyin.');
  return {items,warnings:[...new Set(warnings)]};
}
async function comparePrices(book,{fetcher=fetchLimited,enabled=true}={}){
  const expected=isbn(book.isbn),q=encodeURIComponent(isIsbn(expected)?expected:[book.title,book.author].filter(Boolean).join(' '));
  const searches=RETAILERS.map(r=>({store:r.name,url:r.search(q)})),offers=[],warnings=[];
  const result=()=>({offers:offers.sort((a,b)=>a.price-b.price),searches,warnings:[...new Set(warnings)],checkedAt:new Date().toISOString(),scope:'Aynı ISBN için erişilebilen satıcı ürün sayfalarında doğrulanan TRY fiyatları. Stok ve ödeme tutarı satıcıda kontrol edilmelidir; kargo dahil değildir.'});
  if(!enabled){warnings.push('Canlı fiyat okuma kapalı.');return result();}
  if(!isIsbn(expected)){warnings.push('Fiyat karşılaştırması için kitabın 10 veya 13 haneli ISBN bilgisi gerekli. Satıcı ürün bağlantısından kitap bilgilerini aktarın.');return result();}
  const links=[...new Set([...(book.priceUrls||[]),...(book.buyUrl?[book.buyUrl]:[])])].filter(retailerFor).slice(0,8);
  await Promise.all(RETAILERS.map(async retailer=>{
    let urls=links.filter(url=>retailerFor(url).host===retailer.host).slice(0,3);
    if(!urls.length){
      try{
        let search=retailer.search(q);urls=discoverProducts(await fetcher(search),search,retailer,book);
        if(!urls.length&&book.title){search=retailer.search(encodeURIComponent(book.title));urls=discoverProducts(await fetcher(search),search,retailer,book);}
        if(!urls.length)warnings.push(retailer.name+': arama sayfasında doğrulanabilir ürün bağlantısı bulunamadı (ürünler JavaScript/erişim izni gerektirebilir).');
      }catch(error){warnings.push(sourceError(retailer.name+' arama',error));return;}
    }
    await Promise.all(urls.map(async url=>{try{const inspected=inspectOffer(await fetcher(url),book);if(inspected.offer)offers.push({store:retailer.name,url,...inspected.offer,currency:'TRY',checkedAt:new Date().toISOString()});else warnings.push(retailer.name+': '+inspected.reason);}catch(error){warnings.push(sourceError(retailer.name,error));}}));
  }));
  // A store may expose the same product via multiple canonical links.
  const best=new Map();for(const offer of offers)if(!best.has(offer.store)||offer.price<best.get(offer.store).price)best.set(offer.store,offer);offers.splice(0,offers.length,...best.values());for(let i=warnings.length-1;i>=0;i--)if(offers.some(o=>warnings[i].startsWith(o.store+': '))&&/ISBN.*eşleşmiyor/.test(warnings[i]))warnings.splice(i,1);return result();
}
module.exports={RETAILERS,retailerFor,lookupBooks,extractOffer,comparePrices,fetchLimited,parsePrice,retailerMetadata};
