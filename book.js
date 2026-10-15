const slug=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const k=new URLSearchParams(location.search).get('k'),m=document.getElementById('bk');
const safeLink=url=>{try{const u=new URL(url,location.href);return ['http:','https:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
const link=(label,url,cls='btn ghost')=>{const a=el('a',cls,label);a.href=safeLink(url);a.target='_blank';a.rel='noopener noreferrer';return a;};
fetch('save.ashx?action=content',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json()}).then(d=>{
  document.getElementById('brand').textContent=d.site.brand;
  const b=d.books.find(x=>slug(x.title)===k);
  if(!b){m.append(el('h1',0,'Kitap bulunamadı'));return}
  document.title=b.title+' · '+d.site.brand;
  let cv;if(b.cover){cv=el('img','bk-cover');cv.src=safeLink(b.cover);cv.alt=b.title}else{cv=el('div','bk-cover ph',b.title);cv.style.background=b.color||'#444'}
  const w=el('div');w.append(el('h1',0,b.title),el('p','by',b.author||''),el('span','tag',b.genre||''));
  const meta=[['Sayfa',b.pages],['Yayınevi',b.publisher],['Yıl',b.year],['ISBN',b.isbn]].filter(x=>x[1]);
  if(meta.length){const dl=el('dl');meta.forEach(([a,v])=>dl.append(el('dt',0,a),el('dd',0,v)));w.append(dl)}
  w.append(el('p','desc',b.desc||'Bu kitap için henüz açıklama eklenmedi.'));
  const prices=el('section','prices');prices.append(el('h2',0,'Nereden alabilirim?'));
  const status=el('p','hint','Satıcı fiyatları kontrol ediliyor…');status.setAttribute('role','status');
  const results=el('div','price-results'),searches=el('div','price-searches'),retry=el('button','btn ghost','Yeniden kontrol et');
  prices.append(status,results,searches,retry);w.append(prices);
  async function loadPrices(){
    retry.disabled=true;status.textContent='Satıcı fiyatları kontrol ediliyor…';results.replaceChildren();searches.replaceChildren();
    try{
      const r=await fetch('save.ashx?action=prices&book='+encodeURIComponent(k),{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.msg||'Fiyatlar yüklenemedi.');
      status.textContent=j.offers.length?'Bulunan en düşük ürün fiyatı aşağıda. Kargo hariçtir; ödeme öncesi satıcıda doğrulayın.':'Doğrulanmış güncel fiyat bulunamadı. Aşağıdaki mağazalarda kitabı arayabilirsiniz.';
      j.offers.forEach((o,i)=>{
        const row=el('div','price-row'+(i===0?' best':''));
        row.append(el('span',0,o.store),el('strong',0,new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(o.price)),link(i===0?'En düşük fiyata git':'Satıcıya git',o.url,'btn'));
        if(i===0)row.prepend(el('small','best-label','Karşılaştırılanlar arasında en düşük'));
        results.append(row);
      });
      results.append(el('p','hint',j.scope));
      if(j.offers.length)results.append(el('p','hint','Son kontrol: '+new Date(j.checkedAt).toLocaleString('tr-TR')+' · Sonuçlar 5 dakika önbellekte tutulabilir.'));
      j.searches.forEach(s=>searches.append(link(s.store+'’nda ara',s.url)));
      if(j.warnings.length){const details=el('details');details.append(el('summary',0,'Kaynak durumu'));j.warnings.forEach(s=>details.append(el('p','hint',s)));results.append(details);}
    }catch(e){status.textContent='Fiyat bilgisi şu anda alınamıyor. '+e.message;searches.append(link('D&R’da ara','https://www.dr.com.tr/search?q='+encodeURIComponent(b.isbn||b.title)));}
    finally{retry.disabled=false;}
  }
  retry.onclick=loadPrices;loadPrices();
  if(b.buyUrl)w.append(link('Ek satın alma bağlantısı',b.buyUrl));
  const same=d.books.filter(x=>x.genre===b.genre&&x!==b);
  if(same.length){const mo=el('div','more');mo.append(el('h3',0,'Aynı türden'));same.forEach(x=>{const l=el('a',0,x.title);l.href='kitap.html?k='+slug(x.title);mo.append(l)});w.append(mo)}
  m.append(cv,w)
}).catch(()=>m.append(el('p',0,'İçerik yüklenemedi. Lütfen yeniden deneyin.')));
