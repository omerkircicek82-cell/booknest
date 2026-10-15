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

## Kitap bilgisini güncelleme

Kitaplık bölümünde adı/yazarı veya mümkünse ISBN'yi girip **Bilgi çek** düğmesine basın. Google Books ve Open Library sonuçları kaynak, yazar, yayınevi ve ISBN ile gösterilir. Doğru baskıyı seçin. Varsayılan olarak yalnızca boş alanlar dolar; düzeltme yapmak için **Dolu alanların üzerine de yaz** seçeneğini işaretleyin. Ardından **Kaydet** düğmesine basın.

Toplu doldurma yalnızca ISBN ile eşleşen kayıtları kullanır; yanlış baskıları ilk arama sonucu üzerinden otomatik atamaz. Kaynakların içermediği açıklama veya sayfa sayısı boş kalır ve elle düzenlenebilir. Open Library ilk yayın yılı döndürebilir; baskı yılını kaydetmeden kontrol edin.

Sunucudan `www.googleapis.com` ve `openlibrary.org` HTTPS erişimi gerekir. Kapaklar için ziyaretçi tarayıcısının `covers.openlibrary.org`, `books.google.com` veya kaynağın verdiği kapak alan adına erişmesi gerekir. Kota/ağ hatalarında eldeki bilgiler korunur ve panel hata gösterir.

## Fiyat karşılaştırması

Her kitapta ISBN'yi doğrulayın ve **Fiyat karşılaştırması** alanına her satıra bir gerçek ürün bağlantısı ekleyin. Desteklenen mağazalar: D&R, Kitapyurdu, BKM Kitap, İdefix. Aynı ISBN/baskının bağlantılarını kullanın. Kaydedince kitap detay sayfası satıcı sayfalarından fiyat okumayı dener.

Yalnızca sayfanın JSON-LD Product/Book verisinde aynı ISBN/GTIN, TRY fiyatı ve InStock bilgisi doğrulanırsa teklif gösterilir. En düşük **ürün fiyatı** öne çıkarılır, satıcı bağlantısı verilir. Kargo hesaplanmaz; tüm internetin en ucuz fiyatı iddia edilmez. Satıcının ödeme ekranı son fiyatı belirler. Sonuçlar 5 dakika önbellekte tutulur.

API/ürün akışı mevcut olmadığı için sistem mağazaların tüm kataloglarını kendiliğinden taramaz veya ürün URL'lerini otomatik keşfetmez. Mağaza bot koruması, yönlendirme, eksik ISBN veya yapılandırılmış veri eksikliği varsa fiyat gösterilemez. Arama bağlantıları sunulur; arama bağlantısı fiyat teklifi değildir. ISBN'siz kitaplarda da yalnızca mağaza aramaları gösterilir. Geniş kapsamlı ve garantili otomatik fiyat toplama için mağaza izniyle API/XML ürün akışı entegrasyonu gerekir.

Sunucunun mağaza alan adlarına HTTPS çıkışı olmalı. Güvenlik nedeniyle yönlendirmeler ve listede olmayan alan adları otomatik takip edilmez. Bağlantıları son HTTPS ürün adresi olarak girin.

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

- Node API: 9 test geçti (fiyat ayrıştırma/eşleşme/sıralama, kaynak yedeği, erişim, kayıt ve yeniden başlatmada kalıcılık, yükleme, hız sınırı).
- Chromium: giriş, kayıt/yenileme, bilgi seçimi, mevcut alanları koruma, fiyat yok durumu, en düşük fiyat bağlantısı, mobil taşma, çıkış kontrolleri geçti.
- IIS handler C# kodu Mono derleyicisiyle derlendi; 10 bileşen kontrolü geçti (`test/IisTests.cs`). Bu gerçek Windows/IIS barındırma testi yerine geçmez.
- Bulut ağ politikasının 403 engeli nedeniyle Google/Open Library ve gerçek mağaza fiyatları canlı doğrulanamadı. Gerekli ağ alan adları ortam ayarları taslağına eklendi; taslak kaydı mevcut ağ politikasını değiştirmez.
- `thebooknest.online` üzerinde herhangi bir dosya değişikliği veya yayın yapılmadı. Kitaplara doğrulanmamış bilgi/fiyat eklenmedi.
