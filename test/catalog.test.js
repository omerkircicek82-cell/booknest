const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extractOffer,comparePrices,lookupBooks,retailerFor}=require('../lib/catalog');
const book={title:'Deneme',author:'Yazar',isbn:'9789750738609'};
const product=(price,extra={})=>'<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@type':'Product',gtin13:book.isbn,offers:{'@type':'Offer',price,priceCurrency:'TRY',availability:'https://schema.org/InStock'},...extra})+'</script>';
test('aynı ISBN stoktaki TRY fiyatını okur',()=>assert.equal(extractOffer(product('129.90'),book).price,129.9));
test('farklı baskı, stoksuz, başka para birimi veya bozuk fiyatı kabul etmez',()=>{
 for(const html of [product('10',{gtin13:'9789750738616'}),product('10',{offers:{price:'10',priceCurrency:'TRY',availability:'OutOfStock'}}),product('10',{offers:{price:10,priceCurrency:'EUR',availability:'InStock'}}),product('1.234,56'),product('0'),product('-2'),'<script type="application/ld+json">bad</script>'])assert.equal(extractOffer(html,book),null);
 assert.equal(extractOffer(product(12),{...book,isbn:''}),null);
});
test('fiyat sıralaması ve kaynak hatası birlikte ele alınır',async()=>{
 const b={...book,priceUrls:['https://www.dr.com.tr/kitap/test','https://www.kitapyurdu.com/kitap/test','https://www.bkmkitap.com/test']};
 const r=await comparePrices(b,{fetcher:async url=>{if(url.includes('bkm'))throw Error();return product(url.includes('dr.com')?180:99);}});
 assert.deepEqual(r.offers.map(o=>o.price),[99,180]);assert.equal(r.offers[0].store,'Kitapyurdu');assert.equal(r.warnings.length,1);assert.equal(r.searches.length,4);
});
test('bağlantı olmadan fiyat uydurmaz',async()=>{
 const r=await comparePrices(book,{fetcher:()=>assert.fail('ağ isteği yapılmamalı')});assert.equal(r.offers.length,0);assert.equal(r.searches.length,4);
});
test('özel ağ ve sahte satıcı adresleri reddedilir',()=>{
 for(const u of ['http://dr.com.tr/x','https://127.0.0.1','https://dr.com.tr.attacker.org/x','https://user:pass@dr.com.tr/x','https://dr.com.tr:444/x','file:///etc/passwd','https://localhost'])assert.equal(retailerFor(u),false);
 assert.equal(retailerFor('https://www.dr.com.tr/x').name,'D&R');
});
test('Google kullanılamadığında Open Library sonucu döner',async()=>{
 const r=await lookupBooks('9789750738609',async url=>{if(url.includes('googleapis'))throw Error('quota');return JSON.stringify({docs:[{title:'Deneme',author_name:['Yazar'],isbn:[book.isbn],first_publish_year:2020}]});});
 assert.equal(r.items[0].source,'Open Library');assert.equal(r.items[0].isbn,book.isbn);assert.equal(r.warnings.length,1);
});
test('kaynaklar yokken anlamlı hata döner',async()=>assert.rejects(()=>lookupBooks('Deneme',async()=>{throw Error();}),/ulaşılamadı/));
test('Google alanlarını düzenlenebilir biçime çevirir ve aynı ISBN tekrarını kaldırır',async()=>{
 const r=await lookupBooks(book.isbn,async url=>url.includes('googleapis')?JSON.stringify({items:[{id:'1',volumeInfo:{title:'Deneme',authors:['Yazar'],description:'<p>Açıklama</p>',pageCount:240,industryIdentifiers:[{type:'ISBN_13',identifier:book.isbn}]}}]}):JSON.stringify({docs:[{title:'Deneme',isbn:[book.isbn]}]}));
 assert.equal(r.items.length,1);assert.equal(r.items[0].desc,'Açıklama');assert.equal(r.items[0].pages,'240');
});
