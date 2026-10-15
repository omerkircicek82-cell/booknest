const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');
const {extractOffer,comparePrices,lookupBooks,retailerFor,retailerMetadata,fetchLimited,parsePrice}=require('../lib/catalog');
const book={title:'Emare Maske',author:'Aslı Arslan',isbn:'9786256372030'};
const urls={karton:'https://www.kitapyurdu.com/kitap/emare-maske-karton-kapak/750641.html',ciltli:'https://www.kitapyurdu.com/kitap/emare-maske-ciltli/705151.html'};
const fixture=name=>fs.readFileSync(path.join(__dirname,'fixtures','captured-kitapyurdu-emare-'+name+'.html'),'utf8');
const product=(price,extra={})=>'<script type="application/ld+json">'+JSON.stringify({'@type':'Product',gtin13:book.isbn,offers:{'@type':'Offer',price,priceCurrency:'TRY',availability:'https://schema.org/InStock'},...extra})+'</script>';
const searches=`<a href="${urls.ciltli}?s_token=test">Emare - Maske (Ciltli)</a><a href="${urls.karton}">Emare / Maske (Karton Kapak)</a>`;
test('aynı ISBN için stoktaki TRY fiyatını okur',()=>assert.equal(extractOffer(product('129.90'),book).price,129.9));
test('farklı baskı, stok dışı, başka para birimi ve bozuk fiyat reddedilir',()=>{
 for(const html of [product('10',{gtin13:'9786256372047'}),product('10',{offers:{price:'10',priceCurrency:'TRY',availability:'OutOfStock'}}),product('10',{offers:{price:10,priceCurrency:'EUR',availability:'InStock'}}),product('12,3,4'),product('0'),product('-2'),'<script type="application/ld+json">bad</script>'])assert.equal(extractOffer(html,book),null);
 assert.equal(extractOffer(product(12),{...book,isbn:''}),null);
});
test('yerel ondalık ve binlik ayırıcıları belirsiz değeri fiyat yapmadan okur',()=>{
 for(const [raw,value] of [['1.234,56',1234.56],['293,11',293.11],['293.11',293.11],['1,234.56',1234.56]])assert.equal(parsePrice(raw),value);
 for(const raw of ['1.234','293,111','12,,30','NaN'])assert.equal(parsePrice(raw),null);
});
test('stok belirtilmeyen ürün fiyatını açık etiketle döndürür',()=>{
 const p=extractOffer(product(100,{offers:{price:100,priceCurrency:'TRY'}}),book);assert.equal(p.price,100);assert.equal(p.stockStatus,'unknown');
});
test('fiyat sıralaması kaynak erişim hatasını saklamaz',async()=>{
 const r=await comparePrices({...book,priceUrls:['https://www.dr.com.tr/kitap/test',urls.karton]},{fetcher:async url=>{if(url.includes('bkm')||url.includes('idefix'))throw Error('HTTP 403');return product(url.includes('dr.com')?180:99);}});
 assert.deepEqual(r.offers.map(o=>o.price),[99,180]);assert.equal(r.offers[0].store,'Kitapyurdu');assert.match(r.warnings.join(' '),/403/);
});
test('ISBN olmadan ağ isteği ve uydurma fiyat üretmez; yapılacak işlemi belirtir',async()=>{
 const r=await comparePrices({...book,isbn:''},{fetcher:()=>assert.fail('ağ isteği yapılmamalı')});assert.equal(r.offers.length,0);assert.match(r.warnings.join(' '),/ISBN/);assert.equal(r.searches.length,4);
});
test('özel ağ, kimlik bilgisi, sahte satıcı ve farklı port reddedilir',()=>{
 for(const u of ['http://dr.com.tr/x','https://127.0.0.1','https://dr.com.tr.attacker.org/x','https://user:pass@dr.com.tr/x','https://dr.com.tr:444/x','file:///etc/passwd','https://localhost'])assert.equal(retailerFor(u),false);
 assert.equal(retailerFor('https://www.dr.com.tr/x').name,'D&R');
});
test('yakalanmış gerçek şemada Product ve Book birleşir; baskılar karışmaz',()=>{
 const a=retailerMetadata(fixture('karton'),urls.karton)[0],b=retailerMetadata(fixture('ciltli'),urls.ciltli)[0];
 assert.equal(a.author,'Aslı Arslan');assert.equal(a.pages,'736');assert.equal(a.publisher,'İNDİGO KİTAP');assert.equal(a.language,'tr');assert.notEqual(a.isbn,b.isbn);
 assert.equal(extractOffer(fixture('karton'),book).price,293.11);assert.equal(extractOffer(fixture('ciltli'),book),null);
});
test('Google kotası doluyken Open Library gerçek Türkçe baskı kaydı kullanılır',async()=>{
 const r=await lookupBooks(book.isbn,async url=>{if(url.includes('googleapis'))throw Error('HTTP 429');if(url.includes('/isbn/'))return JSON.stringify({key:'/books/OL1M',title:book.title,languages:[{key:'/languages/tur'}],authors:[{name:book.author}],isbn_13:[book.isbn],publishers:['Yayınevi']});throw Error('unexpected '+url);});
 assert.equal(r.items[0].source,'Open Library');assert.equal(r.items[0].isbn,book.isbn);assert.match(r.warnings.join(' '),/429.*kota/i);
});
test('Google Türkçe araması İngilizce ve yanlış yazar sonuçlarını elekten geçirir',async()=>{
 const queries=[];const r=await lookupBooks('Emare Maske',async url=>{queries.push(url);if(url.includes('googleapis'))return JSON.stringify({items:[{id:'tr',volumeInfo:{title:book.title,authors:[book.author],language:'tr'}},{id:'en',volumeInfo:{title:book.title,authors:[book.author],language:'en'}},{id:'wrong',volumeInfo:{title:book.title,authors:['Başka Yazar'],language:'tr'}}]});return JSON.stringify({docs:[]});},{title:book.title,author:book.author});
 assert.deepEqual(r.items.map(x=>x.id),['tr']);assert.match(queries[0],/langRestrict=tr/);
});
test('tüm diller yalnızca açık seçimle İngilizce baskıyı döndürür',async()=>{
 const r=await lookupBooks('Emare Maske',async url=>url.includes('googleapis')?JSON.stringify({items:[{id:'en',volumeInfo:{title:book.title,authors:[book.author],language:'en'}}]}):JSON.stringify({docs:[]}),{title:book.title,author:book.author,language:'all'});assert.equal(r.items[0].language,'en');
});
test('katı sorgu boşsa başlıkla yeniden arar ve ilgisiz sonucu seçmez',async()=>{
 const q=[];const r=await lookupBooks('Emare Maske',async url=>{if(!url.includes('googleapis'))return JSON.stringify({docs:[]});const term=new URL(url).searchParams.get('q');q.push(term);return JSON.stringify({items:term.includes('inauthor')?[]:[{id:'right',volumeInfo:{title:book.title,authors:[book.author],language:'tr'}}]});},{title:book.title,author:book.author});assert.equal(r.items[0].id,'right');assert.equal(q.length,2);
});
test('Google429 ve katalog boşken mağaza araması iki Türkçe baskıyı bulur',async()=>{
 const r=await lookupBooks('Emare Maske',async url=>{if(url.includes('googleapis'))throw Error('HTTP 429');if(url.includes('openlibrary'))return JSON.stringify({docs:[]});if(url.includes('route='))return searches;if(url===urls.karton)return fixture('karton');if(url===urls.ciltli)return fixture('ciltli');throw Error('unexpected '+url);},{title:book.title,author:book.author});
 assert.deepEqual(new Set(r.items.map(x=>x.isbn)),new Set(['9786256372030','9786256372047']));assert.ok(r.items.every(x=>x.language==='tr'));assert.match(r.warnings.join(' '),/429/);
});
test('doğrudan ürün bağlantısı Googlea istek atmadan metadata verir',async()=>{
 const r=await lookupBooks(urls.karton,async url=>{assert.equal(url,urls.karton);return fixture('karton');},{title:book.title,author:book.author});assert.equal(r.items[0].isbn,book.isbn);assert.equal(r.items[0].productUrl,urls.karton);
});
test('ürün bağlantısı yoksa mağaza aramasını dener ve kesin ISBN ile fiyat seçer',async()=>{
 const r=await comparePrices(book,{fetcher:async url=>{if(!url.includes('kitapyurdu'))throw Error('HTTP 403');if(url.includes('route='))return searches;if(url===urls.karton)return fixture('karton');if(url===urls.ciltli)return fixture('ciltli');throw Error('unexpected');}});
 assert.equal(r.offers.length,1);assert.equal(r.offers[0].price,293.11);assert.equal(r.offers[0].url,urls.karton);
});
test('karma OpenLibrary eserindeki rastgele ISBN kullanılmaz',async()=>{
 const r=await lookupBooks('Emare Maske',async url=>{if(url.includes('googleapis'))return JSON.stringify({items:[]});if(url.includes('openlibrary'))return JSON.stringify({docs:[{title:book.title,author_name:[book.author],isbn:['9780000000000','9780000000001']}]});return '<html></html>';},{title:book.title,author:book.author});assert.equal(r.items.length,0);assert.match(r.warnings.join(' '),/baskı/);
});
test('tüm kaynaklar erişilemezse sonuç yok yerine erişim hatası bildirir',async()=>assert.rejects(()=>lookupBooks('Deneme',async()=>{throw Error('HTTP 403');}),/ulaşılamadı/));
test('satıcı içi kanonik yönlendirme izlenir, farklı alan adına geçilmez',async t=>{
 const seen=[];t.mock.method(global,'fetch',async url=>{seen.push(String(url));return seen.length===1?new Response(null,{status:301,headers:{location:'https://www.kitapyurdu.com/kitap/emare/1.html'}}):new Response('ürün',{status:200,headers:{'content-type':'text/html; charset=utf-8'}});});assert.equal(await fetchLimited('https://kitapyurdu.com/kitap/old/1.html'),'ürün');assert.equal(seen.length,2);
 global.fetch.mock.mockImplementation(async()=>new Response(null,{status:302,headers:{location:'https://127.0.0.1/private'}}));await assert.rejects(()=>fetchLimited(urls.karton),/reddedildi/);
});

test('sayfanın başka ürün önerisindeki fiyat ana ürün fiyatı sayılmaz',()=>{
 const mainUrl='https://www.kitapyurdu.com/kitap/baska/1.html';const html='<link rel="canonical" href="'+mainUrl+'"><script type="application/ld+json">'+JSON.stringify([{'@type':'Product',url:mainUrl,gtin13:'9786256372047',offers:{price:999,priceCurrency:'TRY',availability:'InStock'}},{'@type':'Product',url:urls.karton,gtin13:book.isbn,offers:{price:1,priceCurrency:'TRY',availability:'InStock'}}])+'</script>';assert.equal(extractOffer(html,book),null);
});
