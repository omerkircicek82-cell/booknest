# The Book Nest

Bu sürüm mevcut Windows/IIS sitesi için hazırlanmıştır. Bulutta geliştirmek ve tarayıcı testlerini çalıştırmak için aynı uç noktaları sağlayan Node.js sunucusu da vardır. IIS yayını Node.js gerektirmez.

## Windows / IIS kurulumu

1. Mevcut site klasörünün ve özellikle `content.json`, `img`, `web.config` dosyalarının yedeğini alın. Daha önce bu sürüm kullanıldıysa `App_Data` klasörünü de yedekleyin.
2. `thebooknest-iis.zip` içeriğini sitenin uygulama köküne çıkarın. Mevcut içerik daha güncelse ZIP'teki `content.json` dosyasını onun üzerine yazmayın. Mevcut `img` dosyalarını ve `App_Data` içeriğini koruyun. Eski özel IIS ayarlarınız varsa yeni `web.config` ile birleştirin.
3. IIS'te ASP.NET 4.x, .NET Extensibility ve ISAPI Extensions/Filters etkin olmalı. Uygulama havuzu .NET CLR v4.0 / Integrated olmalı. Güncel .NET Framework 4.8 önerilir; kod 4.5+ API'lerini kullanır. Statik barındırma tek başına `save.ashx` çalıştıramaz.
4. `web.config` içindeki boş `AdminPassword` değerine **en az 12 karakterlik kendinize ait bir parola** yazın. XML özel karakterlerini uygun kaçışlarla yazın (`&` için `&amp;` gibi). Alternatif olarak IIS uygulama sürecine `BOOKNEST_ADMIN_PASSWORD` ortam değişkeni sağlayın; bu değer önceliklidir. Parolayı Git'e yüklemeyin. Eski arşivdeki zayıf parola artık kabul edilmez.
5. Site kökünde `App_Data` ve `img` klasörlerini oluşturun. Yalnızca bu iki klasöre uygulama havuzunun kimliği için Modify izni verin (`IIS AppPool\HAVUZ_ADI`). Kaynak kod klasörünün tamamına yazma izni vermeniz gerekmez.
6. HTTPS kullanın. `/admin.html` adresinden giriş yapın. Kitaplık → kitabı düzenle → Kaydet. Siteyi yenilediğinizde değişiklik görünmelidir.

**Veri saklama:** IIS ilk okumada kökteki `content.json` dosyasını kullanır. İlk kayıttan sonra kalıcı veriler `App_Data/content.json` içinde, önceki sürüm `App_Data/content.bak.json` içinde tutulur. Site ve panel içerikleri `save.ashx?action=content` üzerinden okur. Kökteki başlangıç JSON dosyası artık panelin yazdığı dosya değildir. Yedekten geri almak için siteyi durdurup App_Data içindeki dosyaları değiştirin. Paneldeki JSON indir seçeneği güncel verileri dışa aktarır.

**Kontrol:** Giriş yapın; bir kitabın yayınevini değiştirin, kaydedin ve sayfayı yeniden yükleyin. Siteyi açıp aynı kitabı kontrol edin. Görsel yükleyin. Çıkıştan sonra panelin giriş ekranına döndüğünü kontrol edin. `App_Data/content.json` ve `web.config` adreslerinin ziyaretçiye açılmadığını doğrulayın. Canlı IIS üzerinde bu kontroller yayından sonra yapılmalıdır.

## IIS ana sayfada 403.14 hatası

Bu hata, IIS'in istenen klasör için bir varsayılan belge açamadığını gösterir. Tek başına klasör yazma izni veya admin parolası hatası değildir.

1. Tarayıcıda doğrudan `http://localhost:8181/index.html` adresini deneyin (portu kendi site bağlamanıza göre değiştirin).
2. Sayfa açılırsa IIS Manager → site → **Default Document / Varsayılan Belge** bölümünde özelliğin etkin olduğunu ve listede `index.html` bulunduğunu kontrol edin. Bu sürüm `web.config` içinde `defaultDocument enabled="true"` ayarını açıkça kullanır.
3. Doğrudan `index.html` isteği 404 verirse IIS Manager → site → **Basic Settings / Temel Ayarlar → Physical Path / Fiziksel Yol** değerini kontrol edin. Bu klasörün doğrudan içinde `index.html`, `web.config`, `save.ashx` ve `img` olmalı. Yalnızca ZIP dosyalarını içeren veya çıkarılan dosyaların bir üstündeki klasörü site kökü olarak seçmeyin. Kaynak deposunun `downloads` klasörü hazır paketleri içerir; IIS kökü değildir.
4. Dosyalar doğru yerde olduğu halde kök adresi açılmıyorsa Windows IIS özelliklerinde **Common HTTP Features → Default Document** bileşeninin kurulu olduğunu kontrol edin. Yalnızca yapılandırmayı etkinleştirmek, eksik Windows bileşenini kurmaz.

Klasör listesini göstermek bu uygulamanın başlangıç sayfası sorununu çözmez; site `index.html` ile açılmalıdır. Mevcut yönetici parolanızı ve sunucuya özel ayarlarınızı yeni `web.config` dosyasına aktarın; boş parola içeren örnekle kişisel yapılandırmanızı kaybetmeyin.

## Türkçe karakterlerin bozulması

Sayfadaki sabit yazılar düzgünken fiyat açıklaması veya İdefix adı `TanÄ±mlÄ±` / `Ä°defix` gibi görünüyorsa IIS'in handler kaynak dosyasını hangi kodlamayla derlediğini kontrol edin. Bu sürüm `save.ashx` dosyasını UTF-8 BOM ile saklar; `web.config` içindeki `globalization` kaynak dosyası, istek ve yanıt kodlamalarını UTF-8 olarak belirtir. JSON yanıtının charset değeri de açıkça UTF-8'dir.

Mevcut siteye güncelleme yaparken `save.ashx` dosyasını yenileyin, kendi `web.config` dosyanızdaki `system.web` bölümüne paketteki `globalization` satırını ekleyin ve yönetici parolanızı koruyun. Dosyaları bir editörde yeniden kaydediyorsanız UTF-8 kullanın. IIS yapılandırma değişikliği uygulamayı yeniden başlatıp önbelleği temizler; tarayıcıda Ctrl+F5 yapın. Başlangıç içerikleri ve `App_Data` klasörünü mevcut kayıtlarınızın üzerine yazmayın. Daha önce bozuk kaydedilmiş içerikler varsa onları panelde ayrıca düzeltin; bu güncelleme kayıtlı metinleri otomatik dönüştürmez.

## Kitap bilgisini güncelleme

Kitaplık → **Bilgi çek** penceresinde sorguyu, yazarı ve sonuç dilini değiştirebilirsiniz. Varsayılan **Türkçe baskılar** seçeneği açıkça yabancı dildeki baskıları eler; başka baskılar için **Tüm diller** seçilmelidir. Sonuçlar kendiliğinden uygulanmaz: başlık, yazar, dil, yayınevi ve ISBN'yi karşılaştırıp doğru baskıyı seçin. Dil kaynağın verisinde yoksa bu durum açıkça gösterilir.

Google Books önce başlık/yazar ve Türkçe dil kısıtıyla aranır. Open Library'de eser düzeyindeki karışık ISBN listeleri yerine gerçek baskı kayıtları kullanılır. Kataloglarda eşleşme bulunamazsa Kitapyurdu ürün araması denenir. Bir kitabın mağazada satılması, bu kataloglarda kaydının bulunduğu anlamına gelmez. Google'ın HTTP 429 sorgu kotası hatası ve mağazanın HTTP 403 erişim engeli **kitap bulunamadı** ile aynı durum değildir; panel kaynak hatalarını gösterir.

Doğru ürünün HTTPS adresini de arama alanına yapıştırabilirsiniz: D&R, Kitapyurdu, BKM Kitap veya İdefix. Ürün sayfası erişilebilir ve yapılandırılmış kitap verisi içeriyorsa ISBN, açıklama, sayfa sayısı, yayınevi ve kapak bilgisi içe aktarılır. Mağaza sonucu seçildiğinde fiyat bağlantısı da kitaba eklenir. Kaynağın fiyatı/ISBN'si arama sayfasından tahmin edilmez.

Varsayılan olarak yalnızca boş alanlar dolar. Önceden yanlış doldurulmuş bir alanı düzeltmek için **Dolu alanların üzerine de yaz (ISBN ve baskı dahil)** kutusunu işaretleyin. Farklı ISBN'ye geçerken onay istenir ve önceki baskının fiyat/satın alma bağlantıları temizlenir. Elle ISBN değişikliğinde de eski bağlantılar temizlenir. Seçimden sonra **Kaydet** düğmesine basın.

**Emare – Maske örneği:** Arama alanına `Emare Maske`, yazar alanına `Aslı Arslan` yazın. Kitapyurdu'nun ciltli baskısı `9786256372047`, karton kapak baskısı `9786256372030` ISBN'sini kullanır. Hangi baskıyı karşılaştırmak istediğinizi siz seçin. Doğrudan karton kapak bağlantısı: `https://www.kitapyurdu.com/kitap/emare-maske-karton-kapak/750641.html`. Bu bir kaynak bağlantısıdır; sitede sabit fiyat tutulmaz.

Toplu doldurma yalnızca ISBN ile eşleşen kayıtları kullanır; ilk arama sonucunu otomatik seçmez. Kaynakların içermediği alanlar boş kalır. Kitap tanıtımı/yıl/baskı bilgilerini kaydetmeden kontrol edin.

## Fiyat karşılaştırması

Önce doğru baskının ISBN'sini kaydedin. Sistem, tanımlı ürün bağlantılarını okur; bağlantı bulunmayan desteklenen mağazalarda sınırlı ISBN/başlık araması yapıp ürün sayfalarını doğrulamayı dener. **Fiyat karşılaştırması** alanına her satıra bir doğrudan ürün adresi eklemek arama engelleri veya JavaScript gerektiren arama sayfalarında yardımcı olabilir. Bu da mağazanın ürün sayfasına erişim izni vermesini gerektirir.

JSON-LD Product/Book, ürün kapsamındaki microdata veya açık ürün meta verilerinden **aynı ISBN** ve TRY ürün fiyatı doğrulanır. Ayrı Product/Book şemaları aynı baskı kimliği üzerinden birleştirilir. Yerel ondalık biçimleri desteklenir. Stok dışı/ön sipariş gibi açık durumlar karşılaştırmadan çıkarılır. Stok bilgisi verilmemişse fiyat **stok bilgisi doğrulanmadı** uyarısıyla gösterilir. Kargo hesaplanmaz ve tüm internetin en ucuz fiyatı iddia edilmez; en düşük fiyat erişilebilen, doğrulanmış teklifler arasındadır.

Başarılı sonuçlar 5 dakika; fiyat alınamayan denemeler 30 saniye önbellekte tutulabilir. Kaynak durumu boş sonuçlarda açık gösterilir: eksik ISBN, HTTP 403/429, ürünün başka baskıya ait olması ve yapılandırılmış veri eksikliği ayrı açıklanır. ISBN yokken farklı baskı fiyatları gelişigüzel karıştırılmaz. Mağaza arama bağlantısı bir fiyat teklifi değildir.

Mağaza engelleri aşılmaz; CAPTCHA/bot koruması veya JavaScript ile gelen veriler için otomatik fiyat okuma garanti edilmez. Geniş kapsamlı ve sözleşmeye dayalı sürekli fiyat toplama için izinli API/XML ürün akışı gerekir. Ürün fiyatını ve stok durumunu ödeme öncesi mağazada doğrulayın.

Sunucunun `www.googleapis.com`, `openlibrary.org` ve mağaza alan adlarına HTTPS çıkışı olmalıdır. Aynı mağazanın güvenli HTTPS kanonik yönlendirmeleri sınırlı olarak izlenir; farklı alan adları/özel ağ adresleri reddedilir. Kapaklar için ziyaretçi tarayıcısının kaynağın verdiği görsel alan adına erişmesi gerekir. TLS doğrulaması kapatılmaz.

## Mevcut IIS sitesini güncelleme

`downloads/thebooknest-catalog-fix.zip` yalnızca kod/görünüm dosyaları ve güncelleme notları içerir; mevcut kitap verilerinizi veya yönetici parolanızı içermez. Site dosyalarının yedeğini aldıktan sonra paket içindeki kod dosyalarını site köküne kopyalayın. `App_Data`, `content.json`, `img` ve kişisel `web.config` değerlerinizi koruyun. Önceki UTF-8 düzeltmesi uygulanmadıysa güncelleme notlarındaki `globalization` satırını mevcut `system.web` bölümünüze ekleyin. Ctrl+F5 ile yenileyin; panel tekrar giriş isteyebilir.

## Bulutta / yerelde geliştirme

Node.js 24+ gerekir. Mevcut checkout'u kullanın; yeni bir Git worktree gerekmez.

```sh
cd /workspace/booknest
npm ci --cache /tmp/booknest-npm-cache
npm test
npm run check
```

Sunucuyu çalıştırmak için `.env.example` dosyasını `.env` olarak kopyalayın, `ADMIN_PASSWORD` değerini kendi yerel parolanızla doldurun, ardından `npm start` çalıştırın. Ortam değişkeni olarak da verebilirsiniz. Parola boşsa sunucu başlamaz. Yayında HTTPS kullanırken `SECURE_COOKIE=true` ayarlayın. `.env` ve `.data` Git dışında tutulur; üretim IIS parolasını geliştirme ortamına taşımayın.

Node.js kalıcı verileri `.data/content.json`, yedeği `.data/content.bak.json`, yüklenen görselleri `.data/img` içinde saklar. Başlangıç verileri korunur. `DATA_DIR`, `HOST`, `PORT` değişkenleri desteklenir. `PRICE_FETCH_ENABLED=false` canlı fiyat okumayı durdurur. Proxy değişkenleri Node 24'ün desteklediği şekilde kullanılır; TLS doğrulaması açıktır.

```sh
npm run test:browser
```

Tarayıcı testi `/usr/bin/chromium` gerektirir, geçici sunucu/veri/parola kullanır ve iş bitince temizler. Kitap kaynağı ve fiyat yanıtlarını kontrollü test verileriyle sınar. Ekran görüntüleri `/tmp/booknest-admin-desktop.png` ve `/tmp/booknest-book-mobile.png` dosyalarına yazılır; bunlar gerçek piyasa fiyatı değildir.

## Doğrulama durumu

- Node.js: 20 test geçti; katalog fallback'i, dil/yazar eşleşmesi, doğru baskı, ürün keşfi, fiyat biçimleri, erişim ve kayıt kalıcılığı kapsanıyor.
- Chromium: gerçek tarayıcıda kayıt/yenileme, yükleme, arama sorgusunu değiştirme, dil seçimi, ürün bağlantısı seçimi, baskı değiştirme onayı, eski bağlantı temizliği ve mobil görünüm geçti. Harici kaynaklar bu testte kontrollü yanıtlarla temsil edilir.
- IIS handler C# kodu Mono ile derlendi; 26 bileşen kontrolü geçti. UTF-8 yanıt baytları ve Kitapyurdu'ndan alınmış, uzun tanıtım/tracking bilgileri ayıklanmış örnek şemalar sınanıyor. Bu kontroller gerçek Windows/IIS yayını yerine geçmez.
- Canlı Kitapyurdu Emare – Maske sayfaları hem Node.js hem C# koduyla okundu: iki ayrı baskının Türkçe metadata bilgileri ve seçilen ISBN için ürün fiyatı doğrulandı. C# canlı testinde geçici Mono sertifika deposuna ortamın mevcut güvenilir CA paketi aktarıldı; TLS doğrulaması kapatılmadı. Yakalanmış test fiyatları çalışma zamanında fiyat olarak kullanılmaz.
- Bu oturumun canlı kontrollerinde Google Books HTTP 429 kota hatası, D&R HTTP 403 bakım/erişim engeli, İdefix HTTP 511 erişim reddi döndürdü. BKM arama sayfası ürünleri JavaScript ile yükledi. Bu kaynakların fiyatları çalışıyor diye raporlanmadı; engeller atlatılmadı.
- `thebooknest.online` veya kullanıcının yerel IIS kurulumu üzerinde dosya değişikliği yapılmadı. Mevcut kitap verileri değiştirilmedi; güncelleme ve doğru baskıyı seçme adımları kullanıcı tarafından uygulanmalıdır.
