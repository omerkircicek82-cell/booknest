const slug=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const get=(o,p)=>p.split('.').reduce((a,k)=>a&&a[k],o);
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
fetch('save.ashx?action=content',{cache:'no-store'}).then(r=>r.json()).then(init).catch(()=>{document.body.prepend(el('p',0,'İçerik yüklenemedi (content.json).'))});
function init(d){
  document.title=d.site.title||document.title;
  document.querySelectorAll('[data-t]').forEach(e=>e.textContent=get(d,e.dataset.t)||'');
  document.querySelectorAll('[data-href]').forEach(e=>e.href=get(d,e.dataset.href)||'#');
  document.querySelectorAll('[data-src]').forEach(e=>{const v=get(d,e.dataset.src);v?e.src=v:e.style.display='none'});
  if(d.site.heroPhoto)$('#spines').remove();else $('#heroPhoto').remove();
  d.about.chips.forEach(c=>$('#chips').append(el('span',0,c)));
  d.about.stats.forEach(s=>{const x=el('div'),b=el('b',0,'0');b.dataset.n=s.n;x.append(b,el('span',0,s.label));$('#stats').append(x)});
  // Kitaplık
  const tags=[d.texts.allLabel,...new Set(d.books.map(b=>b.genre))],f=$('#filters'),shelf=$('#shelf');
  const draw=t=>{shelf.innerHTML='';d.books.filter(b=>t===tags[0]||b.genre===t).forEach(b=>{
    const x=el('a','book');x.href='kitap.html?k='+slug(b.title);x.style.background=b.color||'#444';if(b.cover){x.classList.add('cv');x.style.backgroundImage='linear-gradient(transparent 45%,rgba(0,0,0,.75)),url("'+b.cover+'")'}const w=el('div');w.append(el('h4',0,b.title),el('small',0,b.author));x.append(el('span','t',b.genre),w);shelf.append(x)})};
  tags.forEach((t,i)=>{const b=el('button',i?'':'on',t);b.onclick=()=>{[...f.children].forEach(x=>x.classList.remove('on'));b.classList.add('on');draw(t)};f.append(b)});draw(tags[0]);
  $('#pick').onclick=()=>{const b=d.books[Math.floor(Math.random()*d.books.length)];if(b)$('#pickOut').textContent=d.texts.pickPrefix+b.title+' ('+b.author+')'};
  d.series.forEach(s=>{const a=el('article');a.append(el('h3',0,s.name),el('p',0,s.author),el('small',0,s.volumes),el('p',0,s.desc));$('#series').append(a)});
  d.journal.forEach((j,i)=>{const t=el('div','tl'),w=el('div'),h=el('h4');if(j.url){const a=el('a',0,j.title);a.href=j.url;a.target='_blank';a.rel='noopener';h.append(a)}else h.textContent=j.title;w.append(h,el('p',0,j.desc));t.append(el('span',0,String(i+1).padStart(2,'0')),w);$('#journal').append(t)});
  d.ritual.forEach(r=>{const li=el('li'),l=el('label'),i=el('input');i.type='checkbox';i.onchange=upd;l.append(i,' '+r);li.append(l);$('#ritualList').append(li)});
  function upd(){const all=[...document.querySelectorAll('#ritualList input')],n=all.filter(c=>c.checked).length;
    $('#score').textContent=n+'/'+all.length+(n==all.length&&n?' · Hazırsın, kitabı aç!':'')}upd();
  d.photos.forEach(p=>{const g=el('figure'),i=el('img');i.src=p.src;i.alt=p.alt||'';g.append(i,el('figcaption',0,p.caption));$('#photos').append(g)});
  if(d.quotes.length)$('#quote').textContent='“'+d.quotes[Math.floor(Math.random()*d.quotes.length)]+'”';
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;io.unobserve(e.target);
    if(e.target.dataset.n){const end=+e.target.dataset.n;let i=0;const s=Math.max(1,Math.ceil(end/60));const t=setInterval(()=>{i=Math.min(end,i+s);e.target.textContent=i;if(i>=end)clearInterval(t)},25)}
    else e.target.classList.add('in')}),{threshold:.2});
  document.querySelectorAll('.stats b').forEach(e=>io.observe(e));
  document.querySelectorAll('.series article,.tl,.ritual li,.stats div').forEach(e=>{e.classList.add('reveal');io.observe(e)});
}
