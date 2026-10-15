const $=s=>document.querySelector(s),API='save.ashx';
const get=(o,p)=>p.split('.').reduce((a,k)=>a&&a[k],o);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
let D={},offline=false,dirty=false,cur=0;
const T=(k,l)=>[k,l],A=(k,l)=>[k,l,'area'],I=(k,l)=>[k,l,'img'],C=(k,l)=>[k,l,'color'],N=(k,l)=>[k,l,'num'];
const S=[
{p:'site',n:'Genel',t:'obj',f:[T('brand','Site adı (sol üst)'),T('title','Tarayıcı sekme başlığı'),T('eyebrow','Üst küçük yazı'),T('h1a','Büyük başlık 1. satır'),T('h1b','Büyük başlık 2. satır (vurgulu)'),A('lead','Giriş metni'),I('heroPhoto','Giriş fotoğrafı (boşsa kitap sırtları görünür)'),T('igUrl','Instagram linki'),T('kitapUrl','1000Kitap linki'),T('footer','Alt bilgi yazısı')]},
{p:'texts',n:'Başlıklar & Menü',t:'obj',f:['nav1','nav2','nav3','nav4','nav5','nav6','nav7'].map((k,i)=>T(k,'Menü '+(i+1))).concat([T('igBtn','Instagram butonu'),T('shelfBtn','Kitaplık butonu'),T('aboutTitle','Hakkında başlığı'),T('shelfTitle','Kitaplık başlığı'),T('shelfHint','Kitaplık alt yazısı'),T('allLabel','"Hepsi" filtre adı'),T('pickBtn','Kitap öner butonu'),T('pickPrefix','Öneri ön yazısı'),T('seriesTitle','Seriler başlığı'),T('journalTitle','Günlük başlığı'),T('ritualTitle','Ritüel başlığı'),T('ritualHint','Ritüel alt yazısı'),T('photosTitle','Kareler başlığı'),T('photosHint','Kareler alt yazısı'),T('contactTitle','İletişim başlığı'),T('contactHint','İletişim alt yazısı'),T('igHandle','Instagram kullanıcı adı butonu'),T('kitapBtn','1000Kitap butonu')])},
{p:'about',n:'Hakkında',t:'obj',f:[A('p1','1. paragraf'),A('p2','2. paragraf'),I('avatar','Profil fotoğrafı')]},
{p:'about.chips',n:'Etiketler',t:'str'},
{p:'about.stats',n:'İstatistikler',t:'list',h:'label',f:[N('n','Sayı'),T('label','Yazı')]},
{p:'books',n:'Kitaplık',t:'list',h:'title',f:[T('title','Kitap adı'),T('author','Yazar'),T('genre','Tür (Klasik, Gerilim...)'),C('color','Kapak rengi'),I('cover','Kapak resmi (isteğe bağlı, boşsa renk kullanılır)'),T('pages','Sayfa sayısı'),T('publisher','Yayınevi'),T('year','Yayın yılı'),T('isbn','ISBN'),T('buyUrl','Satın alma bağlantısı (isteğe bağlı)'),['priceUrls','Fiyat karşılaştırması: her satıra bir ürün bağlantısı (D&R, Kitapyurdu, BKM Kitap, İdefix)','urls'],A('desc','Kitap açıklaması')],blank:{color:'#7a2e3a'}},
{p:'series',n:'Seriler',t:'list',h:'name',f:[T('name','Seri adı'),T('author','Yazar'),T('volumes','Kitaplar'),A('desc','Açıklama')]},
{p:'journal',n:'Günlük & Vlog',t:'list',h:'title',f:[T('title','Başlık'),A('desc','Açıklama'),T('url','Video/Instagram linki (isteğe bağlı)')]},
{p:'ritual',n:'Ritüel',t:'str'},
{p:'photos',n:'Fotoğraflar',t:'list',h:'caption',f:[I('src','Fotoğraf'),T('caption','Alt yazı'),T('alt','Görsel açıklaması')]},
{p:'quotes',n:'Sözler',t:'str'}];
const mark=()=>{dirty=true;st('● Kaydedilmemiş değişiklik')};
function st(m,c){const s=$('#st');s.textContent=m;s.className=c||''}
function tabs(){const a=$('#tabs');a.innerHTML='';S.forEach((s,i)=>{const b=el('button',i==cur?'on':'',s.n);b.onclick=()=>{cur=i;tabs();view()};a.append(b)})}
function setp(o,p,v){const k=p.split('.'),l=k.pop();k.reduce((a,x)=>a[x],o)[l]=v}
function form(o,fields){
  const w=el('div');
  fields.forEach(([k,l,t])=>{
    const lab=el('label','f',l);let inp;
    if(t=='area'||t=='urls'){inp=el('textarea');inp.value=t=='urls'?(o[k]||[]).join('\n'):o[k]||'';if(t=='urls')inp.placeholder='https://www.kitapyurdu.com/kitap/...';}
    else if(t=='img'){inp=imgField(o,k,lab);w.append(lab);return}
    else{inp=el('input');inp.type=t=='color'?'color':t=='num'?'number':'text';inp.value=o[k]??''}
    inp.dataset.field=k;
    inp.oninput=()=>{
      if(k==='isbn'&&isbnKey(inp.value)!==isbnKey(o[k])&&((o.priceUrls||[]).length||o.buyUrl)){
        o.priceUrls=[];o.buyUrl='';
        for(const name of ['priceUrls','buyUrl']){const field=w.querySelector('[data-field="'+name+'"]');if(field)field.value=''}
        let note=w.querySelector('.edition-note');if(!note){note=el('p','edition-note');lab.append(note)}
        note.textContent='ISBN değiştiği için önceki baskının fiyat ve satın alma bağlantıları temizlendi. Bu baskının ürün bağlantılarını yeniden ekleyin.';
      }
      o[k]=t=='num'?+inp.value:t=='urls'?inp.value.split(/\n/).map(v=>v.trim()).filter(Boolean):inp.value;mark()
    };
    lab.append(inp);w.append(lab);
  });return w}
function imgField(o,k,lab){
  const box=el('div','imgf'),pv=el('img'),tx=el('input');tx.type='text';tx.value=o[k]||'';pv.src=tx.value;pv.onerror=()=>pv.style.opacity=.2;pv.onload=()=>pv.style.opacity=1;
  tx.oninput=()=>{o[k]=tx.value;pv.src=tx.value;mark()};
  const f=el('input');f.type='file';f.accept='image/*';
  f.onchange=async()=>{if(!f.files[0])return;if(offline){alert('Yükleme için sunucu işleyicisi gerekli. Dosyayı img klasörüne elle kopyalayıp yolunu yaz.');return}
    const file=f.files[0];if(file.size>5*1024*1024){st('Görsel en fazla 5 MB olabilir','err');return}st('Yükleniyor...');
    try{const r=await fetch(API+'?action=upload',{method:'POST',headers:{'Content-Type':file.type},body:file}),j=await r.json();
      if(r.ok){tx.value=j.path;tx.oninput();st('✓ Fotoğraf yüklendi (Kaydet\'e basmayı unutma)','ok')}else st('Hata: '+j.msg,'err')}catch(e){st('Yükleme başarısız','err')}};
  box.append(pv,tx,f);lab.append(box);return tx}
function view(){
  const s=S[cur],m=$('#main');m.innerHTML='';m.append(el('h2',0,s.n));
  const arr=get(D,s.p);
  if(s.t=='obj'){const c=el('div','card');c.append(form(arr,s.f));m.append(c);return}
  const tools=el('div','tools'),q=el('input');q.placeholder='Ara...';const add=el('button','b','+ Yeni ekle');tools.append(q,add);if(s.p=='books'){const af=el('button','b alt','⚡ Boşları otomatik doldur');af.onclick=()=>autoFill(arr,draw);tools.append(af)}m.append(tools);
  const box=el('div');m.append(box);
  const mv=(i,d)=>{const j=i+d;if(j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];mark();draw()};
  const del=i=>{if(confirm('Silinsin mi?')){arr.splice(i,1);mark();draw()}};
  function draw(){
    box.innerHTML='';
    arr.forEach((it,i)=>{
      const lab=s.t=='str'?it:(it[s.h]||'(boş)');
      if(s.t=='str'){const r=el('div','row'),inp=el('input');inp.value=it;inp.oninput=()=>{arr[i]=inp.value;mark()};
        const u=el('button',0,'↑'),d=el('button',0,'↓'),x=el('button',0,'🗑');u.onclick=()=>mv(i,-1);d.onclick=()=>mv(i,1);x.onclick=()=>del(i);r.append(inp,u,d,x);r.dataset.q=it.toLowerCase();box.append(r);return}
      const c=el('div','card'),h=el('div','ch'),sp=el('span',0,(i+1)+'. '+lab);
      const u=el('button',0,'↑'),d=el('button',0,'↓'),x=el('button',0,'🗑');u.onclick=()=>mv(i,-1);d.onclick=()=>mv(i,1);x.onclick=()=>del(i);
      h.append(sp,u,d,x);c.append(h,form(it,s.f));if(s.p=='books'){const fb=el('button','b alt','🔎 Bilgi çek');fb.onclick=()=>pickInfo(it,draw);const note=el('p','book-help','Önce Türkçe baskıyı ve ISBN’yi doğrulayın. Fiyat karşılaştırması kaydedilmiş kitap bilgilerini kullanır.');c.append(fb,note)}c.dataset.q=JSON.stringify(it).toLowerCase();box.append(c);
    })}
  add.onclick=()=>{if(s.t=='str')arr.push('');else{const o={};s.f.forEach(f=>o[f[0]]=f[2]=='num'?0:f[2]=='urls'?[]:'');Object.assign(o,s.blank||{});arr.push(o)}
    mark();draw();box.lastElementChild.scrollIntoView({behavior:'smooth'});const i=box.lastElementChild.querySelector('input,textarea');i&&i.focus()};
  q.oninput=()=>[...box.children].forEach(c=>c.hidden=!c.dataset.q.includes(q.value.toLowerCase()));
  draw()}
const strip=h=>(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const isbnKey=value=>{
  let n=String(value||'').replace(/[^0-9X]/gi,'').toUpperCase();
  if(n.length===10){n='978'+n.slice(0,9);n+=(10-[...n].reduce((sum,d,i)=>sum+Number(d)*(i%2?3:1),0)%10)%10}
  return n;
};
const productLink=value=>{try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&['dr.com.tr','kitapyurdu.com','bkmkitap.com','idefix.com'].some(h=>u.hostname===h||u.hostname==='www.'+h)?u.href:''}catch{return ''}};
const sourceLink=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
async function gb(it,options={}){
  const q=(options.q??(it.isbn||it.title||'')).trim(),isIsbn=/^(?:[0-9][\s-]*){9}[0-9X]$|^(?:[0-9][\s-]*){13}$/.test(q);
  const params=new URLSearchParams({action:'books',q,title:isIsbn||/^https?:\/\//i.test(q)?it.title||'':q,author:options.author??it.author??'',lang:options.lang||'tr'});
  if(isIsbn)params.set('isbn',q);
  const r=await fetch(API+'?'+params,{cache:'no-store'});
  const j=await r.json();if(!r.ok)throw new Error(j.msg||'Bilgi araması başarısız.');return j;
}
function fill(it,v,force){
  if(v.isbn&&it.isbn&&isbnKey(v.isbn)!==isbnKey(it.isbn)&&!force)return false;
  if(v.isbn&&isbnKey(v.isbn)!==isbnKey(it.isbn)&&((it.priceUrls||[]).length||it.buyUrl)){
    if(!confirm('Seçilen baskının ISBN’si farklı. Önceki baskının fiyat ve satın alma bağlantıları temizlenecek. Bu baskıyı seçmek istiyor musun?'))return false;
    it.priceUrls=[];it.buyUrl='';
  }
  for(const k of ['title','author','desc','pages','publisher','year','isbn','cover']){
    if(v[k]&&(force||!it[k]))it[k]=v[k];
  }
  const url=productLink(v.productUrl);if(url){it.priceUrls=[...new Set([...(it.priceUrls||[]),url])]}
  mark();return true;
}
async function pickInfo(it,cb){
  const m=el('div','modal'),bx=el('div','mbox');m.append(bx);document.body.append(m);
  const previous=document.activeElement;let request=0;
  const close=()=>{request++;m.remove();previous?.focus()};m.onclick=e=>{if(e.target==m)close()};
  bx.setAttribute('role','dialog');bx.setAttribute('aria-modal','true');bx.setAttribute('aria-labelledby','lookup-title');
  const heading=el('h3',0,'Kitap bilgisi ara');heading.id='lookup-title';bx.append(heading,el('p','book-help','Kitap adını sadeleştirerek, ISBN ile veya D&R, Kitapyurdu, BKM Kitap ve İdefix ürün bağlantısını yapıştırarak yeniden arayabilirsin.'));
  const search=el('form','lookup-form'),ql=el('label','f','Kitap adı, ISBN veya mağaza ürün bağlantısı'),q=el('input');q.type='search';q.value=it.isbn||it.title||'';q.required=true;ql.append(q);
  const al=el('label','f','Yazar (isteğe bağlı)'),author=el('input');author.value=it.author||'';al.append(author);
  const ll=el('label','f','Sonuç dili'),lang=el('select');lang.setAttribute('aria-label','Sonuç dili');for(const [value,label] of [['tr','Türkçe baskılar'],['all','Tüm diller']]){const o=el('option',0,label);o.value=value;lang.append(o)}ll.append(lang);
  const submit=el('button','b','Ara');submit.type='submit';search.append(ql,al,ll,submit);
  const msg=el('p','lookup-status');msg.setAttribute('role','status');msg.setAttribute('aria-live','polite');
  const warnings=el('div','lookup-warnings'),itemsBox=el('div','lookup-results');
  const ow=el('input');ow.type='checkbox';const ol=el('label','overwrite');ol.append(ow,' Dolu alanların üzerine de yaz (ISBN ve baskı dahil)');
  bx.append(search,msg,warnings,ol,itemsBox);
  async function run(){
    const token=++request;submit.disabled=true;msg.textContent='Kaynaklarda aranıyor…';warnings.replaceChildren();itemsBox.replaceChildren();
    try{
      const result=await gb(it,{q:q.value,author:author.value,lang:lang.value});if(token!==request)return;
      const items=Array.isArray(result.items)?result.items:[],notes=Array.isArray(result.warnings)?result.warnings:[];
      msg.textContent=items.length?'Kitap adı, yazar, dil ve ISBN’yi karşılaştırıp doğru baskıyı seç. Dolu alanlar, kutuyu işaretlemediğin sürece korunur.':notes.length?'Bazı kaynaklardan bilgi alınamadı veya sonuçlar doğrulanamadı. Bu, kitabın mağazada olmadığı anlamına gelmez. Aşağıdaki kaynak durumunu incele; ISBN ya da doğrudan ürün bağlantısıyla tekrar dene.':'Bu arama için eşleşen baskı bulunamadı. Yazar alanını sadeleştir, ISBN veya mağaza ürün bağlantısıyla tekrar ara. Yabancı baskılar için “Tüm diller”i seç.';
      if(notes.length){warnings.append(el('b',0,'Kaynak durumu'));notes.forEach(note=>warnings.append(el('p',0,String(note))))}
      items.forEach(v=>{
        const row=el('div','lookup-result'),b=el('button','res'),im=el('img'),t=el('span','result-copy');b.type='button';
        if(v.cover){const cover=sourceLink(v.cover);if(cover)im.src=cover}im.alt='';im.loading='lazy';
        const language=v.language?({tr:'Türkçe',tur:'Türkçe',en:'İngilizce',eng:'İngilizce'}[v.language]||v.language):'Dil belirtilmemiş';
        t.append(el('b',0,v.title||'?'),el('span','result-author',v.author||'Yazar belirtilmemiş'),el('small',0,[v.publisher,v.year,language].filter(Boolean).join(' · ')),el('small',0,(v.source||'Kaynak belirtilmemiş')+' · ISBN: '+(v.isbn||'Belirtilmemiş')));
        b.append(im,t);b.onclick=()=>{if(v.isbn&&it.isbn&&isbnKey(v.isbn)!==isbnKey(it.isbn)&&!ow.checked){msg.textContent='Bu sonucun ISBN’si kayıtlı baskıdan farklı. Bu baskıya geçmek için “Dolu alanların üzerine de yaz” kutusunu işaretle; eski fiyat bağlantıları temizlenir.';msg.scrollIntoView({block:'nearest'});return}if(fill(it,v,ow.checked)){close();cb()}};
        row.append(b);const url=sourceLink(v.sourceUrl||v.productUrl);if(url){const a=el('a','source-link','Kaynakta aç');a.href=url;a.target='_blank';a.rel='noopener noreferrer';row.append(a)}itemsBox.append(row)
      });
    }catch(e){if(token!==request)return;msg.textContent='Arama tamamlanamadı: '+(e.message||'Kaynaklara ulaşılamadı.')+' Aynı pencerede sorguyu veya ürün bağlantısını değiştirerek tekrar deneyebilirsin.'}
    finally{if(token===request)submit.disabled=false}
  }
  search.onsubmit=e=>{e.preventDefault();run()};
  const c=el('button','b alt','Kapat');c.type='button';c.onclick=close;bx.append(c);
  m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const fields=[...bx.querySelectorAll('button:not(:disabled),input,select,a[href]')],first=fields[0],last=fields[fields.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};
  q.focus();q.select();run();
}
async function autoFill(arr,cb){
  const todo=arr.filter(b=>!b.desc||!b.isbn||!b.publisher||!b.pages);if(!todo.length){alert('Kitapların temel bilgileri tamam.');return}
  if(!confirm(todo.length+' kitap için yalnızca ISBN ile kesin eşleşen sonuçlar doldurulacak. Diğerlerini Bilgi çek ile seçebilirsin. Devam?'))return;
  let n=0,bad=0;
  for(const b of todo){st('Bilgi çekiliyor '+(++n)+'/'+todo.length+'...');
    try{const {items}=await gb(b);const norm=v=>String(v||'').replace(/[-\s]/g,'');const match=b.isbn&&items.find(v=>norm(v.isbn)===norm(b.isbn));if(match)fill(b,match,false);else bad++}catch(e){st(e.message,'err');cb();return}
    await new Promise(r=>setTimeout(r,500))}
  cb();st('✓ Bitti'+(bad?' ('+bad+' kitap için elle sonuç seçilmeli)':'')+'. Kontrol edip Kaydet\'e bas.','ok')}
async function save(){
  if(offline){dl();return}
  st('Kaydediliyor...');
  try{const r=await fetch(API+'?action=save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(D,null,1)});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok){dirty=false;st('✓ Kaydedildi — site güncellendi','ok')}else st('Hata: '+(j.msg||r.status),'err')}catch(e){st('Sunucuya ulaşılamadı','err')}}
function dl(){const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(D,null,1)],{type:'application/json'}));a.download='content.json';a.click();st('content.json indirildi, sunucudaki dosyayla değiştir','ok')}
async function start(){
  try{D=await (await fetch('save.ashx?action=content',{cache:'no-store'})).json()}catch(e){alert('content.json okunamadı');return}
  $('#app').hidden=false;if(offline){$('#save').textContent='JSON indir (çevrimdışı)';st('Çevrimdışı: değişiklikler siteye kaydedilmez.')}tabs();view()}
const LOGIN='admin.html',PANEL='panel.html',chk=p=>fetch(API+'?action=login',{method:'POST',headers:p?{'X-Admin-Pass':p}:{}});
if($('#lf')){ // ---- giriş sayfası
  $('#lf').onsubmit=async e=>{e.preventDefault();const p=$('#pw').value;$('#lmsg').textContent='';
    try{const r=await chk(p);
      if(r.status==403||r.status==429){const j=await r.json().catch(()=>({}));$('#lmsg').textContent=j.msg||'Şifre hatalı';return}
      const j=await r.json();if(!r.ok){$('#lmsg').textContent=j.msg||'Giriş başarısız.';return}sessionStorage.removeItem('off');sessionStorage.removeItem('p');

      location.href=PANEL}
    catch(x){$('#lmsg').textContent='Sunucu işleyicisi (save.ashx) çalışmıyor.';$('#off').hidden=false}};
  $('#off').onclick=()=>{sessionStorage.removeItem('p');sessionStorage.off='1';location.href=PANEL};
  chk().then(r=>r.ok&&(location.href=PANEL)).catch(()=>{});
}
if($('#app')){ // ---- panel sayfası
  $('#save').onclick=save;$('#dl').onclick=dl;
  $('#out').onclick=async()=>{await fetch(API+'?action=logout',{method:'POST'}).catch(()=>{});sessionStorage.removeItem('p');sessionStorage.removeItem('off');location.href=LOGIN};
  addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
  addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key=='s'){e.preventDefault();save()}});
  if(sessionStorage.off){offline=true;start()}
  else chk().then(r=>r.ok?start():(location.href=LOGIN)).catch(()=>location.href=LOGIN);
}
