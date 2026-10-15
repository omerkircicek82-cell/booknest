const {chromium}=require('playwright-core');
const {spawn}=require('node:child_process');
const fs=require('node:fs/promises'),crypto=require('node:crypto'),assert=require('node:assert/strict');

// External catalog and seller responses below are controlled fixtures, not live prices or claims of live provider access.
(async()=>{
 const password=crypto.randomBytes(24).toString('hex'),dir=await fs.mkdtemp('/tmp/booknest-ui-');let server,browser;
 try{
  server=spawn(process.execPath,['server.js'],{cwd:require('node:path').join(__dirname,'..'),env:{...process.env,ADMIN_PASSWORD:password,DATA_DIR:dir,HOST:'127.0.0.1',PORT:'0'}});
  const base=await new Promise((resolve,reject)=>{server.stderr.on('data',b=>reject(Error(String(b))));server.stdout.on('data',b=>{const m=String(b).match(/port (\d+)/);if(m)resolve('http://127.0.0.1:'+m[1])});server.on('exit',code=>reject(Error('Server exited: '+code)))});
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[],queries=[];
  page.on('pageerror',e=>errors.push(e.message));
  const retailerUrl='https://www.dr.com.tr/kitap/emare-maske/asli-arslan/edebiyat/roman/turkiye-roman/urunno=0002016956002';
  let metadata={items:[],warnings:['Kontrollü kaynak yanıtı: Google Books HTTP 429; kota doldu.']};
  let prices={offers:[],searches:[{store:'D&R',url:'https://www.dr.com.tr/search?q=emare'}],warnings:['Kontrollü kaynak yanıtı: D&R HTTP 403; ürün sayfasına erişilemedi.'],scope:'Yalnızca erişilebilen, aynı ISBN ile eşleşen ürünler; kargo hariç.',checkedAt:new Date().toISOString()};
  await page.route('**/save.ashx?action=books*',r=>{queries.push(new URL(r.request().url()).searchParams);return r.fulfill({json:metadata})});
  await page.route('**/save.ashx?action=prices*',r=>r.fulfill({json:prices}));
  await page.goto(base+'/admin.html');await page.locator('#pw').fill(password);await page.getByRole('button',{name:'Giriş',exact:true}).click();await page.waitForURL('**/panel.html');
  const books=()=>page.getByRole('button',{name:'Kitaplık',exact:true}).click(),card=()=>page.locator('.card').first();
  const save=async()=>{await page.locator('#save').click();await page.locator('#st').filter({hasText:'site güncellendi'}).waitFor()};
  await books();await card().getByLabel('Yayınevi',{exact:true}).fill('Tarayıcı Test Yayınevi');await save();await page.reload();await books();
  assert.equal(await card().getByLabel('Yayınevi',{exact:true}).inputValue(),'Tarayıcı Test Yayınevi','saved metadata must persist');

  await page.getByRole('button',{name:'Fotoğraflar',exact:true}).click();
  await card().locator('input[type=file]').setInputFiles({name:'controlled-pixel.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=','base64')});
  await page.locator('#st').filter({hasText:'Fotoğraf yüklendi'}).waitFor();const uploaded=await card().locator('.imgf input[type=text]').inputValue();assert.match(uploaded,/^img\/[a-f0-9-]+\.png$/);await save();await page.reload();await page.getByRole('button',{name:'Fotoğraflar',exact:true}).click();assert.equal(await card().locator('.imgf input[type=text]').inputValue(),uploaded,'uploaded photo path must persist');

  await books();await card().getByRole('button',{name:'🔎 Bilgi çek'}).click();
  const modal=page.getByRole('dialog'),query=()=>modal.getByLabel('Kitap adı, ISBN veya mağaza ürün bağlantısı',{exact:true}),author=()=>modal.getByLabel('Yazar (isteğe bağlı)',{exact:true}),lang=()=>modal.getByLabel('Sonuç dili',{exact:true});
  await modal.getByText('Kaynak durumu',{exact:true}).waitFor();assert.equal(queries.at(-1).get('lang'),'tr');assert.equal(queries.at(-1).get('author'),'Aslı Arslan');assert.equal(await modal.locator('.res').count(),0);assert.match(await modal.locator('.lookup-status').textContent(),/mağazada olmadığı anlamına gelmez/);
  const selected={title:'Emare: Sarmaşık',author:'Aslı Arslan',isbn:'9789750738609',publisher:'Kontrollü Türkçe Kaynak',pages:'300',desc:'Kontrollü kaynak açıklaması',source:'D&R (test yanıtı)',language:'tr',sourceUrl:retailerUrl,productUrl:retailerUrl};
  metadata={items:[selected],warnings:[]};await query().fill('Emare');await author().fill('');await modal.getByRole('button',{name:'Ara',exact:true}).click();await modal.getByText('Türkçe',{exact:false}).last().waitFor();
  assert.equal(queries.at(-1).get('q'),'Emare');assert.equal(queries.at(-1).get('title'),'Emare');assert.equal(queries.at(-1).get('author'),'');assert.equal(queries.at(-1).get('lang'),'tr');assert.equal(await card().getByLabel('Sayfa sayısı',{exact:true}).inputValue(),'','search results must never apply automatically');
  assert.equal(await modal.getByRole('link',{name:'Kaynakta aç'}).getAttribute('rel'),'noopener noreferrer');
  metadata={items:[{...selected,title:'English edition (controlled fixture)',language:'en',source:'Open Library (test yanıtı)'}],warnings:[]};await lang().selectOption('all');await modal.getByRole('button',{name:'Ara',exact:true}).click();await modal.getByText('İngilizce',{exact:false}).waitFor();assert.equal(queries.at(-1).get('lang'),'all');
  metadata={items:[selected],warnings:[]};await lang().selectOption('tr');await query().fill(retailerUrl);await modal.getByRole('button',{name:'Ara',exact:true}).click();await modal.locator('.res').filter({hasText:'Kontrollü Türkçe Kaynak'}).waitFor();assert.equal(queries.at(-1).get('q'),retailerUrl);assert.equal(queries.at(-1).get('isbn'),null);await modal.locator('.res').click();
  assert.equal(await card().getByLabel('Sayfa sayısı',{exact:true}).inputValue(),'300');assert.equal(await card().getByLabel('Yayınevi',{exact:true}).inputValue(),'Tarayıcı Test Yayınevi','existing fields must remain by default');assert.equal(await card().getByLabel('ISBN',{exact:true}).inputValue(),selected.isbn);assert.equal(await card().locator('textarea[data-field=priceUrls]').inputValue(),retailerUrl,'selected retailer URL must be attached');await save();

  // A different edition cannot silently retain a stale retailer URL or overwrite the stored ISBN.
  metadata={items:[{...selected,isbn:'9786051853777',productUrl:'',sourceUrl:'javascript:alert(1)'}],warnings:[]};await card().getByRole('button',{name:'🔎 Bilgi çek'}).click();await modal.locator('.res').waitFor();assert.equal(queries.at(-1).get('isbn'),selected.isbn);assert.equal(await modal.getByRole('link',{name:'Kaynakta aç'}).count(),0,'unsafe source links must be omitted');await modal.locator('.res').click();await modal.locator('.lookup-status').filter({hasText:'ISBN’si kayıtlı baskıdan farklı'}).waitFor();assert.equal(await card().getByLabel('ISBN',{exact:true}).inputValue(),selected.isbn);
  await modal.getByRole('checkbox').check();page.once('dialog',d=>d.accept());await modal.locator('.res').click();assert.equal(await card().getByLabel('ISBN',{exact:true}).inputValue(),'9786051853777');assert.equal(await card().locator('textarea[data-field=priceUrls]').inputValue(),'','old edition URLs must be cleared');
  await card().locator('textarea[data-field=priceUrls]').fill(retailerUrl);await card().getByLabel('Satın alma bağlantısı (isteğe bağlı)',{exact:true}).fill(retailerUrl);await card().getByLabel('ISBN',{exact:true}).fill(selected.isbn);assert.equal(await card().locator('textarea[data-field=priceUrls]').inputValue(),'');assert.equal(await card().getByLabel('Satın alma bağlantısı (isteğe bağlı)',{exact:true}).inputValue(),'');await card().getByText('ISBN değiştiği için',{exact:false}).waitFor();await save();
  await page.screenshot({path:'/tmp/booknest-admin-desktop.png',fullPage:false});

  await page.goto(base+'/kitap.html?k=emare-sarmasik');await page.getByText('Bu denemede bu baskı için doğrulanabilir fiyat alınamadı.',{exact:false}).waitFor();assert.equal(await page.locator('.source-status').getAttribute('open'),'');await page.getByText('Kontrollü kaynak yanıtı: D&R HTTP 403; ürün sayfasına erişilemedi.',{exact:true}).waitFor();
  prices={...prices,offers:[{store:'Kitapyurdu (kontrollü test)',price:99.9,url:'https://www.kitapyurdu.com/kitap/test/1.html',stockStatus:'unknown'}],warnings:[]};await page.getByRole('button',{name:'Yeniden kontrol et'}).click();await page.getByRole('link',{name:'En düşük fiyata git',exact:true}).waitFor();await page.getByText('Stok bilgisi doğrulanmadı; mağazada kontrol edin.',{exact:true}).waitFor();assert.equal(await page.getByRole('link',{name:'En düşük fiyata git',exact:true}).getAttribute('href'),'https://www.kitapyurdu.com/kitap/test/1.html');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/booknest-book-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'book page must fit mobile');
  const missing=await (await page.request.get(base+'/save.ashx?action=content')).json();delete missing.books[0].isbn;prices={...prices,offers:[],warnings:['ISBN eksik; aynı baskı doğrulanamadı.']};await page.route('**/save.ashx?action=content',r=>r.fulfill({json:missing}));await page.reload();await page.getByText('Bu kitapta ISBN kayıtlı olmadığı için',{exact:false}).waitFor();await page.unroute('**/save.ashx?action=content');

  await page.goto(base+'/panel.html');await books();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'admin must fit mobile');await card().getByRole('button',{name:'🔎 Bilgi çek'}).click();await modal.locator('.res').waitFor();assert.equal(await lang().inputValue(),'tr','each search defaults to Turkish');assert.equal(await modal.evaluate(e=>e.scrollWidth>e.clientWidth),false,'metadata modal must fit mobile');await page.keyboard.press('Escape');assert.equal(await modal.count(),0,'Escape must close the modal');
  await page.locator('#out').click();await page.waitForURL('**/admin.html');await page.goto(base+'/panel.html');await page.waitForURL('**/admin.html');assert.deepEqual(errors,[]);
  console.log('PASS: browser login, persistent save/photo upload, Turkish-first metadata retry, explicit all-language search, retailer URL import, safe source links, edition confirmation and stale URL clearing, source failures, ISBN guidance, observed-price link/stock warning, mobile layout, logout/access. External providers mocked.');
 }finally{if(browser)await browser.close();if(server)server.kill();await fs.rm(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
