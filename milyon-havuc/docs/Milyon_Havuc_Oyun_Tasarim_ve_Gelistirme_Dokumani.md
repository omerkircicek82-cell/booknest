# Milyon Havuç Oyun Tasarım ve Geliştirme Dokümanı

**Sürüm 0.1 · Codex uygulama brifi · Tek oyunculu PC oyunu**

## 1. Oyunun vaadi

Dev bir tarlanın kapısını açıyorsun. Karşında tam **1.000.000 havuç** var. Arkanda ise homurdanan küçük bir havuç öğütücüsü. İlk havucu kendi elinle söküyorsun, kovana koyuyorsun ve dönüp makinenin ağzına atıyorsun. İlk parayla bir kazma, sonra daha büyük bir kova alıyorsun. Bir süre sonra tarlaya saldığın ilk robot, sen başka bir sırada çalışırken kendi topladığı havuçları makineye taşımaya başlıyor. Finalde tek başına bir havuç söktüğün tarla, hasat araçları ve taşıma bantlarıyla çalışan küçük bir üretim tesisine dönüşüyor.

**Oyuncu hedefi:** Tarladaki havuçların tamamını sökmek ve son havucu da öğütücüden geçirmek. Yeniden ekim, havuç satın alma ya da sonsuz hasat yok. İşlenen sayı tam olarak 1.000.000 olduğunda oyun biter.

**Tür:** Birinci şahıs, 3D, rahat tempolu hasat ve otomasyon oyunu. Referans uygulama **Unity ve URP** ile Windows PC için tasarlanmıştır. Var olan bir Unity projesi kullanılacaksa sürümü ve paketleri Codex önce depodan tespit eder. Yeni projede kesin sürüm, makinede kurulu ve ekipçe seçilen Unity sürümüne göre README’ye yazılır.

**Süre hedefi:** İlk oynayışta **120–180 dakika**, dengeleme referansı **150 dakika**. Bu, oyunun başında bekleme koyarak değil, elden kazmaya, toplu hasada ve otomasyona geçişin zamanlamasıyla sağlanır. Süre tablosu bir tasarım bütçesidir. Gerçek sonuç ölçülmeden “2–3 saatte bitiyor” diye kabul edilmez.

**Kapsam sınırı:** İlk sürümde tek harita, tek kampanya, tek para birimi ve yerel kayıt. Çok oyunculu, yemek tarifleri, ekim, savaş, görev NPC’leri, hava durumu, serbest bina yerleştirme ve çevrimdışı üretim yok. Bu özelliklerin hiçbiri ilk oynanabilir sürümün ön koşulu değildir.

## 2. Oyuncunun yaptığı işler

1. **Sök.** Bakışını havuca çevir, sol tuşu basılı tut. Eylem süresi dolunca havuç yerden çıkar ve çantaya girer. El tek bir havuç alır. İleri aletler ve eğitimler aynı eylemle bir grup havucu söker.
2. **Taşı.** Başlangıçta altı havuç taşırsın. Kova dolunca başka havuç sökemezsin. İlk öğütücü başlangıç noktasının hemen arkasındadır ve ilk sıraya yaklaşık 6 metre mesafededir.
3. **Dök.** Öğütücünün girişine yaklaş ve **E** tuşuna bas. Kapasite yetiyorsa çantadaki havuçlar tek hareketle makinenin haznesine gider. Hazneye giren havuç henüz para ya da XP kazandırmaz.
4. **İşle.** Makine her öğüttüğü havuç başına para ve XP üretir. İlk kullanımda bunun anlaşılması için huniye giren havuç, dönen dişli ve HUD’daki gelir artışı birbirini takip eder.
5. **Yatırım yap.** Parayla ekipman ve makineler al. Toplam XP seviyeni yükseltir ve beceri puanı kazandırır. Bu puanları eğitimlere harca. İki ilerleme kanalı birbirine bağlıdır ama para ve beceri puanı birbirinin yerine geçmez.
6. **Yeni sıraya geç.** Temizlenen parselden sonra bir sonraki parsel açılır. Aletler ve makineler güçlendikçe bir sıranın boşalması gözle görülür biçimde hızlanır. Son işleme kadar bu döngü sürer.

Havuçların içine fizik nesnesi gibi düşüp kaybolması gerekmez. Çantaya ve hazneye aktarım önce oyun verisinde yapılır. Ekrandaki fırlama, savrulma ve düşme yalnızca görsel geri bildirimdir.

### İlk iki dakika

- Oyuncu tarlaya dönük başlar. Öğütücü arkasındadır. İlk havuç, yürümeye gerek kalmadan birkaç adım ötede belirgin biçimde görünür.
- İlk ipucu “Sol tuşu basılı tut ve havucu sök.” İlk havuçta kaybolur. Sonraki ipucu “Arkandaki öğütücüye yaklaş ve E ile dök.”
- Oyuncu tek havuçla dönebilir. Altı havucu doldurmak zorunlu değildir. İlk öğütme tamamlanınca “+1 para · +1 XP” gösterilir ve dükkân işareti görünür.
- İlk mağaza hedefi 18 paraya Küçük Kova, ilk alet hedefi 35 paraya El Kazmasıdır. Öğretici alışverişi zorla açmaz. Oyuncu küçük kovayı atlayıp kazmaya biriktirebilir.
- Hedef, yeni bir oyuncunun ilk kazmayı yaklaşık 1–3 dakikada alabilmesidir. İlk söküm ve döküm testi, hareket animasyonu tamamlanmadan da çalışmalıdır.

## 3. Tarla planı ve tam bir milyon havuç

### Harita

Oyun alanı **10 × 10 parselden** oluşur. Her parsel **100 × 100 hücre** içerir ve her hücrede bir havuç vardır. Sonuç **100 × 10.000 = 1.000.000** benzersiz havuçtur. Hücre aralığı iki eksende **0,55 m**. Parselin ekili alanı yaklaşık **55 × 55 m**. Parseller arasında yollar, servis geçitleri, tabelalar ve makine yuvaları bulunur. Görüş çizgisi ve alçak eğimler tarlanın büyüklüğünü hissettirir.

- Oyuncu birinci parselde başlar. Parseller haritada yılan düzeninde açılır. Yol bağlantısı, son satırın sonundan bir sonraki satırın başına geri koşmayı gerektirmez.
- Bir sonraki parselin kilidi, aktif parselde **toprakta kalan havuç sıfıra indiğinde** açılır. İşlenmemiş havuçlar açılışı engellemez ama finali engeller.
- Oyuncu önceki parselleri ziyaret edebilir. Kilitli parsellere yol kenarından bakabilir ama orada hasat yapamaz. Arayüz aktif parseli ve kalan miktarı gösterir.
- İlk öğütücü sabittir. Mobil Öğütücü alındığında aktif parselin servis yuvasına taşınabilir. Bant satın alınca bitişik parseller arasında giriş noktası değişebilir. Tesis yeri değişse de işleme haznesi ve içindeki ürün aynıdır.
- **Kök Tarayıcı** açılana kadar bir parselde 50 veya daha az havuç kaldığında ücretsiz tabela yön oku en yakın kümeyi gösterir. Tarayıcı bu yardımı erkenden ve daha ayrıntılı verir. Tek havuç yüzünden oyun kilitlenmez.

### Görsel bölgeler

| Bölge | Parsel | Görsel kimlik | Oynanış amacı |
|---|---:|---|---|
| Başlangıç Ovası | 1–5 | Ahşap çit, sabah sisi, eski öğütücü | Elle sökme, kova ve ilk robot |
| Kızıl Sırt | 6–20 | Kızıl toprak, taş duvarlar, küçük yükseltiler | Geniş aletler ve mobil taşıma |
| Rüzgâr Yolu | 21–55 | Açık ova, rüzgâr gülleri, servis yolları | Bant, traktör ve filo yönetimi |
| Son Hat | 56–100 | Geniş ufuk, endüstriyel servis yuvaları | Tam otomasyon ve final taraması |

Bölgeler aynı hasat kurallarına tabidir. Toprak rengi verimi değiştirmez. Kilitli bölgeyi erken göster, ancak ilk sürümde bölgeler için ayrı yapay zekâ, fizik veya rastgele olay yazma.

## 4. Kontroller ve eylem kuralları

| Girdi | Eylem |
|---|---|
| WASD / fare | Yürü ve bak |
| Shift | Koş. Dayanıklılık çubuğu yok |
| Sol fare | Hedefe bakarken hasat. Basılı tutunca eylem, geçerli hedef ve boş yer oldukça tekrarlanır |
| E | Öğütücüye dök, taşıma noktasına teslim et, servis yuvasını kullan veya araçtan in/bin |
| 1–3 | El / sahip olunan en iyi el aleti / motorlu ekipman |
| Tab | Dükkân, Beceri, Tarla Haritası ve Filo sekmeleri |
| Esc | Duraklat, ayarlar, kayıt, ana menü |

İlk ayarlar: 4,5 m/s yürüme, 6,5 m/s koşu, 2,0 m elle hedefleme, 2,5 m teslim etkileşimi. Satın alınan aletler hedefleme menzilini 2,5–4,5 m aralığına çıkarabilir. Arayüz açıkken dünya girdisi ve hasat durur. Duraklatma otomasyonu da dondurur. Eylemin hedefi menzil dışına çıkarsa ilerleme sıfırlanır. Animasyon bitişi envanterin kaynağı değildir. Hasat animasyonunun iptal olması, bitmemiş eylemden ürün vermez.

**Alan hasadı:** Merkezde bakılan canlı havuçtan başlanır. Alete göre yakın hücreler, sıra doğrultusunda bir dikdörtgen ya da daire taranır. Hücreler önce mesafe, eşitlikte hücre ID sırasıyla işlenir. Dolu envanter, kilitli parsel, boş hücre ve başkasının aldığı hedef geçilir. “24 havuç” yazan bir alet, uygun alanda en az 24 canlı hücre yoksa gerçek sayıyı toplar. Bir eylem iki parseli aynı anda kapsamaz.

## 5. Ekonomi ve ödül kuralları

- Başlangıç: **0 para**, **0 XP**, el, **6 kapasiteli bez çanta**, **24 kapasiteli hazne**, **4 havuç/s** öğütme hızı.
- Her işlenen havuç **1 temel para ve 1 XP** verir. Bot, araç ve el hasadı eşit ödüllenir. Satın alınan “Pazar” yetenekleri parayı değiştirir. XP hiçbir zaman beceri almak için geriye gitmez.
- Para birimi arayüzde **₵** ile gösterilir. Harcama yalnızca para bakiyesini azaltır. İade ya da satış ilk sürümde yok. Alet ve taşıma ekipmanı tek sefer alınır, yüksek sınıf eski aleti silmez.
- Pazar becerisinde yalnızca en yüksek alınan kademe uygulanır. Örneğin Pazar Bilgisi II ile havuç başına 1,20 ₵. Hesap para biriminin yüzde biriyle yapılır. Arayüz küsuratı gösterebilir ama işlem başına yuvarlama ile değer kaybedilmez.
- Kazanç hesabı yalnızca öğütme adımında yapılır. Bir havuç huniye girerken, kayıt yüklenirken veya bot yolda yürürken tekrar para kazandırmaz.
- **Dükkân fiyatı** tek seferlik ürünlerde sabittir. Robot kopyaları ilk alımdan sonra sınırlı ve kademeli pahalıdır. Tek seferlik ürünlerde “satın alındı”, robotlarda “3/4” gibi sayaç gösterilir.
- Mağaza kilitleri toplam işlenen havuca bakar. Bakiye düşse bile açılmış ürün tekrar kilitlenmez. Yetersiz bakiye veya gereksinim durumunda düğme gerekçeyi açıkça gösterir. Yanlış alışveriş oyunu kalıcı olarak kilitlemez. Havuç sonlu olduğu için aşağıdaki kritik ürünler, mevcut bir ekipmanı bozmaz ve işletim gideri yaratmaz.

## 6. Dükkân kataloğu

Fiyatlar ilk test dengesi içindir. **Açılış**, toplam işlenen havuç sayısıdır. “Etki” sütunundaki kapasite yeni toplamı, “+” işareti ise artışı ifade eder. Bir ön koşul yazılmadıkça ilgili ürün doğrudan alınabilir.

### Hasat aletleri

| Ürün / veri ID | Fiyat | Açılış | Etki |
|---|---:|---:|---|
| El / hand | 0 | 0 | 1 havuç, 0,55 sn. Başlangıç ekipmanı |
| El Kazması / hoe | 35 | 0 | En çok 3 havuç, 0,70 sn, yakın küme |
| Çift Dişli Çapa / rake | 160 | 120 | En çok 6 havuç, 0,78 sn, sıra boyunca |
| Sıra Söken / row_lifter | 640 | 550 | En çok 12 havuç, 0,92 sn, dar ve uzun alan |
| Akülü Hasatçı / power_lifter | 2.800 | 2.000 | En çok 24 havuç, 0,88 sn, dikdörtgen alan |
| Geniş Ağız / wide_head | 9.500 | 8.000 | En çok 48 havuç, 1,05 sn. Akülü Hasatçı gerekir |
| Kök Vakumu / root_vac | 26.000 | 22.000 | En çok 90 havuç, 1,10 sn, yakın daire |
| Sıra Traktörü / tractor | 55.000 | 55.000 | Sürerken ön sırada en çok 110 havuç/s, kendi kasası 1.200 |
| Geniş Traktör Kafası / tractor_head | 105.000 | 140.000 | Traktörün üst sınırı 155 havuç/s, kasası 3.200 |
| Kök Tarayıcı / scanner | 4.500 | 5.000 | Kalan kümeleri işaretler. Hasat veya ürün vermez |

Traktör yalnızca sürerken toplar. Dökme noktasına yakınken **E** öncelikle kasa boşaltır. Boşaltma mümkün değilse araçtan inme için ekranda ayrı bir tuş ipucu gösterilir. İlk sürümde traktör bir karakter kontrolcüsü ve görsel modelle uygulanabilir. Lastik fiziği, motor hasarı ve yakıt yok.

### Taşıma ve işleme

| Ürün / veri ID | Fiyat | Açılış | Etki |
|---|---:|---:|---|
| Küçük Kova / bucket_small | 18 | 0 | Çanta kapasitesi 16 |
| Galvaniz Kova / bucket_large | 80 | 55 | Çanta kapasitesi 40 |
| Sırt Sepeti / basket | 300 | 220 | Çanta kapasitesi 100 |
| El Arabası / cart | 1.100 | 800 | Çanta kapasitesi 250 |
| Çekmeli Kasa / trailer | 4.800 | 3.500 | Çanta kapasitesi 650 |
| Konveyör Çantası / belt_pack | 16.000 | 13.000 | Çanta kapasitesi 1.800 |
| Endüstriyel Kasa / bulk_bag | 42.000 | 38.000 | Çanta kapasitesi 4.000 |
| Hazne Genişletme / hopper | 130 | 100 | Hazne 120, hız 10/s |
| Güçlü Motor / motor | 780 | 650 | Hazne 420, hız 28/s |
| Mobil Öğütücü / mobile | 3.300 | 2.400 | Hazne 1.600, hız 60/s. Parsel servis yuvasına taşınır |
| Taşıma Bandı / belt | 11.000 | 9.000 | Hazne 4.500, hız 130/s. Aktif parselde ikinci giriş |
| Çift Hat / dual_line | 38.000 | 32.000 | Hazne 12.000, hız 230/s |
| Endüstriyel Öğütücü / industrial | 100.000 | 90.000 | Hazne 30.000, hız 340/s |
| Fabrika Hattı / factory | 220.000 | 240.000 | Hazne 80.000, hız 460/s |

Öğütücü kademeleri üst üste eklenmez. Sahip olunan en yüksek kademe geçerlidir. Alt kademe satın almak kapasiteyi veya hızı düşürmez. Bant özelliği daha yüksek kademe alındığında kaybolmaz. Hazne doluysa yalnızca sığan miktar aktarılır. Kalanlar çantada veya araç kasasında kalır.

### Otomasyon ve destek

| Ürün / veri ID | İlk fiyat | Açılış | Etki |
|---|---:|---:|---|
| Fidebot / bot_seed | 550 | 450 | 1,8 havuç/s söküm, yük 30, en çok 3 adet |
| Sıra Robotu / bot_row | 4.200 | 3.200 | 8 havuç/s, yük 140, en çok 4 adet |
| Kazıcı Bot / bot_dig | 16.000 | 14.000 | 20 havuç/s, yük 380, en çok 4 adet |
| Kargo Drone’u / drone | 24.000 | 20.000 | Havuç sökmez. Robotların teslimat gecikmesini %35 azaltır, en çok 1 adet |
| Otonom Hasatçı / bot_auto | 55.000 | 65.000 | 48 havuç/s, yük 850, en çok 4 adet |
| Filo Kumandası / fleet_console | 18.000 | 16.000 | Parsel önceliği, bot duraklatma ve boşta uyarıları. Otomatik çalışma bununla kilitli değil |
| Ağır Hasatçı / bot_heavy | 135.000 | 190.000 | 85 havuç/s, yük 1.800, en çok 3 adet |
| Akıllı Rota / route_ai | 62.000 | 80.000 | Drone yoksa teslimat gecikmesi −%20, varsa toplam −%55 |
| Son Kök Protokolü / sweep | 60.000 | 450.000 | Parselde 100 ve altı kaldığında makineler sıraya değil, en yakın kalan canlı hücrelere öncelik verir |

**Robot fiyatı:** Aynı üründen n’inci kopyanın fiyatı = ilk fiyat × kopya çarpanı. İlk dört kopya için **1,00 / 1,35 / 1,80 / 2,40**. Fiyat tam para birimine yukarı yuvarlanır. Ürün adedi sınırına ek olarak eşzamanlı **8 aktif toplama yuvası** vardır. Yeni bot alınırken yuva doluysa bot garaja gider. Oyuncu Filo sekmesinde hangilerinin çalışacağını ücretsiz değiştirir. İlk sürümde Filo sekmesindeki temel aktif/pasif değiştirme herkese açıktır. Kumanda ürünü gelişmiş öncelik ve uyarı ekler.

**Otomasyonun davranışı:** Botlar aktif parselin ayrı şeritlerinden söküm yapar. Kendi yükü dolduğunda veya son hedefi bittiğinde servis yuvasına döner, haznede yer varsa boşaltır ve devam eder. Parsel değiştiğinde önce elindeki havuçları teslim eder, sonra yeni parsele yönelir. Botların kazı hızı tablodaki üst sınırdır. Teslimat süresi yüzünden gerçek hız daha düşüktür. Normal servis turuna yük başına **8 saniye** temel teslimat gecikmesi koy. Drone ve Akıllı Rota bunu toplam en çok %55 azaltır. Botlar dolu haznenin önünde kayıpsız bekler.

Örnek: Sıra Robotu 140 havucu yaklaşık 17,5 saniyede söker. Teslimat 8 saniye daha sürerse gerçek hız 140 ÷ 25,5 ≈ **5,49 havuç/s** olur. Hazne doluysa daha da düşer. Bu ayrım Filo arayüzünde “Söküm hızı” ve “Son 60 sn teslimat” olarak gösterilir.

## 7. XP ve beceri ağacı

Her işlenen havuç 1 XP kazandırır. Aşağıdaki toplam XP eşikleri her geçildiğinde **1 beceri puanı** ver. Bir işlemde birden çok eşik geçilirse hepsini ver. Başlangıç seviyesi 1 ve harcanabilir puan 0. Son eşik 950.000 XP. Final sonrasında kullanılmayacak bir puan verme.

**Toplam XP eşikleri:** 20, 70, 160, 300, 550, 900, 1.500, 2.500, 4.000, 6.500, 10.000, 16.000, 24.000, 36.000, 52.000, 72.000, 100.000, 135.000, 175.000, 225.000, 285.000, 350.000, 425.000, 505.000, 585.000, 665.000, 745.000, 820.000, 890.000, 950.000.

Her satırın I → II → III sırası kendi ön koşuludur. Beceri ağacında dalı açmak için başka bir daldan seçim gerekmez. Dalların toplam bedeli 39 puan, kampanya boyunca kazanılabilen 30 puandır. Oyuncu tüm ağacı doldurmaz. Seçim hatasına karşı **ücretsiz yeniden dağıtım** yapılabilir. Hazne veya envanter kapasitesini etkileyen beceri düşürülürken mevcut ürün yeni sınırın üstündeyse miktar silinmez, yalnızca kapasitenin altına inene dek yeni ekleme engellenir.

| Dal / beceri ID kökü | I · 1 puan | II · 2 puan | III · 3 puan |
|---|---|---|---|
| Geniş Kavrama / reach | El +1, el aleti ×1,25 | El +2, el aleti ×1,50 | El +3, el aleti ×1,80 |
| Seri Hasat / tempo | Eylem süresi −%10 | −%20 | −%32 |
| Taşıma Ustalığı / carry | Çanta +%15 | +%30 | +%50 |
| Pazar Bilgisi / market | Para +%10 | +%20 | +%35 |
| Öğütme Ustalığı / grind | Makine hızı +%10 | +%20 | +%30 |
| Robot Bakımı / robotics | Bot söküm hızı +%8 | +%16 | +%25 |
| Hat Optimizasyonu / logistics | Hazne +%15 · 1 puan | Hazne +%30 · 1 puan | Hazne +%50 · 1 puan |

Rakamlar kademe toplamıdır, aynı daldaki kademeler toplanmaz. Örneğin Seri Hasat II’de süre %20 azalır, %30 değil. Seri Hasat süresi **0,22 sn** altına inmez. Geniş Kavrama el aletinde hedef sayısını aşağı yuvarlar ve I alındığında elle iki havuç toplanabilir. Motorlu el aletleri bu dala dahildir. Traktör ve robotlar Geniş Kavrama ve Seri Hasat’tan etkilenmez. Taşıma Ustalığı yalnızca oyuncu çantasını büyütür. Robot Bakımı yalnızca söküm hızını değiştirir. Hat Optimizasyonu öğütücü hızına etki etmez.

**Anlamlı tercihler:** Erken aktif rota için Geniş Kavrama ve Seri Hasat, daha az dönüş için Taşıma Ustalığı, otomasyon için Robot Bakımı ve Öğütme Ustalığı. Pazar erken ekipmana erişimi hızlandırır. Hazne büyük ama öğütücü yavaşsa üretim hızlanmaz, yalnızca kuyruk büyür. Mağaza bu farkı “Hazne dolu”, “Öğütücü boşta” ve “Teslimat bekliyor” durumlarıyla öğretir.

## 8. Kampanya temposu ve dengeleme

Aşağıdaki süreler yeni oyuncunun menüleri okumaya, ilk turları öğrenmeye ve uygun alımları denemeye zaman ayırdığı karma rota için başlangıç bütçesidir. İşlenen havuç sütunu kümülatiftir. Hız, dilim boyunca makineden çıkması gereken **ortalama** havuç sayısıdır. Aktif hasat hızıyla karıştırılmamalıdır.

| Geçen oyun süresi | İşlenen havuç | Dilim ortalaması | Beklenen deneyim |
|---|---:|---:|---|
| 0–10 dk | 0 → 1.000 | 1,7/s | Elle sök, ilk kovayı ve kazmayı al, ilk Fidebot’u kur |
| 10–25 dk | 1.000 → 10.000 | 10/s | Sıra aletleri, araba, mobil öğütücü ve ilk parsel geçişi |
| 25–50 dk | 10.000 → 50.000 | 26,7/s | Bant, kök vakumu ve farklı tipte robotların birlikte çalışması |
| 50–80 dk | 50.000 → 200.000 | 83,3/s | Traktör, teslimat optimizasyonu ve ilk otonom hasatçı |
| 80–115 dk | 200.000 → 500.000 | 142,9/s | Ağır hasatçı, daha hızlı üretim hattı, düzenli filo değişimleri |
| 115–150 dk | 500.000 → 1.000.000 | 238,1/s | En verimli dizilim, kalan parsellerin taraması ve final |

Son dilimde örnek bir filo, iki Ağır Hasatçı ve iki Otonom Hasatçı ile başlar. Robot Bakımı III ve teslimat gecikmesini %55 kısaltan iki yükseltme varsa bir Ağır Hasatçı yaklaşık 87 havuç/s, bir Otonom Hasatçı yaklaşık 48 havuç/s teslim eder. Örnek filo teorik olarak yaklaşık **270 havuç/s** teslim eder. Parsel geçişi, seyrek son sıralar ve hazne beklemeleri nedeniyle ortalaması bunun altında kalabilir. Bu teorik kapasite, 238 havuç/s dilim hedefinin imkânsız olmadığını gösterir. Örnek ekipmanların belirtilen dakikada satın alınabilir olduğu ayrıca fiyat ve alışveriş simülasyonunda doğrulanmalıdır.

### Süreyi gerçekçi ölç

1. İlk uygulamada ekonomi simülasyonuna oyun ile aynı katalog, fiyat hesapları, XP eşikleri ve işleme hızı ver. Render ve hareket olmadan sabit **0,25 saniye** adımlarla zaman ilerlet.
2. Aktif oyuncu, karma oyuncu ve otomasyon ağırlıklı oyuncu için üç deterministik alım politikası oluştur. Oyuncu hareketi ve alışveriş için öngörülen kesintileri ayrı modelle. Örnek başlangıç varsayımları: menü/karar için toplam %12 boş zaman, taşıma turu için mesafeye göre yürüme ve 0,4 sn dökme, parsel geçişi için 12 sn. Oyun testi bunları değiştirebilir.
3. Her politika için toplam süre, 1 bin/10 bin/50 bin/200 bin/500 bin havuç zamanları, satın alma sırası, son bakiye, tesisin dolu veya boş beklediği süre, tarladaki son 1.000 havucun kaç dakika aldığı ve el/robot/traktör payı raporlanır.
4. Simülasyonla kontrol edildikten sonra en az **üç yeni oyuncuya** ilk 20 dakikayı oynat. Ardından en az **iki tam oturumda** kampanyayı baştan sona ölç. Oturum sayısı kesin istatistik için yeterli değildir. Ama sıkışan başlangıcı veya uzayan finali yakalamaya yardımcı olur. Kaydedilen test sonucu README veya denge raporuna eklenir.
5. Karma rota 120–180 dakikanın dışındaysa önce robot teslimat süresine, öğütücü hızına ve kritik fiyatlara bak. Oyuncuya yapay bekleme kapısı koyma. Oyun çok çabuk bitiyorsa hasadı kesmek yerine en güçlü otomasyonun maliyeti ve açılış zamanını düzenle. Oyuncular 3 saati sürekli aşıyorsa hangi darboğazın neden olduğunu ölç ve sadece orayı değiştir.

**Kalibrasyon soruları:** İlk 10 dakikanın ne kadarı boş yürümeye gidiyor? İlk botu görmek için ne kadar süre elde tek tek hasat yapılıyor? Ne zaman öğütücü bottan yavaş kalıyor? Son üç parselde oyuncu anlamlı bir karar alıyor mu, yoksa yalnızca ilerleme çubuğunu mu izliyor? Her yeni ürün güçlü görünse de mağazada birbirinin aynısı üç yükseltme yan yana duruyorsa ikisini birleştir.

## 9. Arayüz ve geri bildirim

**Oyun HUD’u:** Üst bölümde “İşlenen 12.450 / 1.000.000” ve toplam ilerleme çubuğu. Ayrı satırda toprakta kalan havuç gösterilir. Alt bölümde seçili ekipman, eylem halkası ve “Çanta 36 / 40”. Makineye bakınca “Hazne 85 / 120 · 10/s · E ile dök”. Ekranın sağında bakiye ve bir sonraki XP eşiğine kalan miktar. Saniyede yüzlerce ödül balonu çıkarma. Hızlı işlemede tek toplam bildirim göster.

**Dükkân:** Alet, taşıma, öğütme ve filo filtreleri. Kartlarda ürünün mevcut ve yeni değeri, fiyatı ve kilit gerekçesi yan yana. Örnek: “Çanta 40 → 100”, “Daha açılmadı · 220 havuç işle”, “Eksik 14 ₵”. Bir makine yükseltmesi alt kademeden düşükse oyuncuya mevcut kapasitesinin düşmeyeceği gösterilir.

**Beceri:** Her dalda üç basamak, mevcut beceri puanı, toplam XP, seviye ve sonraki eşik. Kademenin etkisini toplam değerle yaz. Yetenekleri yeniden dağıtma ekranında hangi değerlerin değişeceği görünür.

**Tarla Haritası:** 10 × 10 hücre. Kilitli, aktif ve temizlenmiş parseller renk + simge ile ayırt edilir. Tıklanınca parsel adı, kalan havuç, servis yuvası ve varsa atanmış botlar görünür. MVP’de hızlı seyahat şart değildir.

**Filo:** Her bot için tür, durum, yük, aktif/pasif ve teslimat hızının son 60 saniyelik ortalaması. Durumlar “Hasat”, “Teslimata dönüyor”, “Hazne dolu”, “Hedef arıyor”, “Garajda”. Pasif yapmak, dolu yükü anında yok etmez. Bot önce eldeki yükü teslim edip sonra garaja gider. Yuva doluluğu hesabında teslimata giden pasifleştirilmiş bot, artık hasat etmediği için aktif söküm yuvası sayılmaz.

**Görsel ve ses:** Sıcak toprak, turuncu havuçlar, yeşil yapraklar, çizik sac ve ahşap. İlk sökümde kısa kök sesi, toprak zerresi ve elde bir havuç. Öğütücü boşken düşük uğultu, çalışırken dönüş ve kapaktan kısa turuncu akış. Botların hareketi ve renkleri işlevlerini anlatsın. Ekran sarsıntısı kapatılabilsin. Fare hassasiyeti, görüş alanı, ses seviyeleri ve basılı tutma/tetikleme seçeneği olsun. Önemli durumlar yalnızca ses veya renkle anlatılmasın.

### Final akışı

Topraktaki son havuç söküldüğünde “Tarla temiz. Son havuçları öğütücüye ulaştır.” bildirimi gelir. Havuçlar çantada, traktörde, botta veya haznede ise HUD nerede kaldıklarını gösterir. İşlenen sayı 1.000.000 olunca üretim durur, zafer kaydı alınır ve final kartı açılır. Kartta süre, elle ve araçla toplanan havuç, botların katkısı, toplam kazanç, en yüksek teslimat hızı ve “Tarla artık boş” mesajı bulunur. Oyuncu isterse tarlada dolaşır ya da ana menüye döner. Yeni kampanya eski kaydı açık onay olmadan silmez.

## 10. Teknik uygulama planı

### Sahneler ve kod düzeni

| Konum / bileşen | Sorumluluk |
|---|---|
| Scenes/Bootstrap | Hizmetleri kur, kayıt varsa ana menüye bildir |
| Scenes/Farm | Oyuncu, dünya, parsel yöneticisi, tesis, ışık ve HUD |
| Core/CampaignState | Tarladaki, envanterdeki, botlardaki, haznedeki ve işlenmiş havuç durumunun tek kaynağı |
| World/FieldGrid | Hücre ID, konum, parsel erişimi, hasat bitleri ve parsel sayaçları |
| Harvest/HarvestService | Hedef doğrulama, araç veya el alanı seçimi ve envanter aktarımı |
| Processing/GrinderService | Hazne girişi, sabit adımda öğütme ve ekonomi olayı |
| Economy/WalletAndProgress | Tam sayı bakiye, toplam kazanç, XP, beceri puanları, alım doğrulaması |
| Automation/FleetService | Robot yükü, görev geçişleri ve sabit adımda hedef seçimi |
| Data/Catalogs | Ürün, beceri ve kampanya dengesi. Unity ScriptableObject veya eşdeğer tek veri kaynağı |
| Persistence/SaveService | Şemalı kayıt, yedek, doğrulama, yükleme ve sürüm dönüşümleri |
| UI/Presentation | HUD, dükkân, ağaç, filo ve harita. Kuralları doğrudan değiştirmez |
| Tests/EditMode ve Tests/PlayMode | Saf kural testleri ve sahne etkileşimi testleri |

Unity’ye bağımlı görsel katmanı ekonomi kurallarından ayır. Ekonomi ve tarla kurallarını Unity sahnesi açmadan test edilebilir C# sınıflarında tut. ScriptableObject’leri çalışma anında değiştirme. Yeniden başlatılan oyun sabit katalog verilerini ve yeni kampanya durumunu ayrı yüklesin. Girdi sistemi için projede var olan çözümü kullan, yoksa PC klavye ve fare için tek yöntem seçip README’ye yaz.

### Havuçları bir milyon nesneye dönüştürme

- `cellId = parcelId * 10000 + row * 100 + column`. `parcelId` 0–99, satır ve sütun 0–99. Bu kimlik kameradan ve görsel akıştan bağımsızdır.
- Hasat edilen hücreleri **bit dizisinde** sakla. 1.000.000 bit = **125.000 bayt** ham durum. Her parselin kalan sayısını ayrıca tut ve kayıt yüklerken bitlerden doğrula.
- Havuçlar için tek tek GameObject, collider, Update veya NavMesh agent oluşturma. Yakın alanı örnekli çizimle grupla. Önerilen çizim parçası **20 × 20 hücre**, en fazla 400 görsel örnek. Hasat edilen hücreyi ait olduğu parçanın çizim önbelleğinden çıkar.
- Yakın alanda yaprak veya tam havuç modeli, uzakta daha basit sıra yüzeyi kullan. Kilitli parseller uzaktan görünebilir ancak içlerindeki bütün havuçlar ayrı ayrı çizilmez. Kamera etkileşimi zemin raycast’i ve grid sorgusuyla çalışır.
- Oyuncunun elinde, konveyörde veya havada gösterilen havuçlar havuzlanmış efektlerdir. Bu nesnelerin yok olması, kayıttaki havuç sayısını değiştirmez.
- 1080p’de orta seviye hedef PC’de 60 FPS bütçesi koy. Ölçüm alınan gerçek sistem, kalite ayarı ve en yoğun test sahnesi raporlanır. İlk kontrol, 8 aktif bot + traktör + yüksek öğütücü hızında her karede tekrar eden tahsisler ve takılmalardır.

### Tek durum akışı ve muhasebe

**Değişmez kural:** `toprak + oyuncuCantasi + aracKasasi + botYukleri + hazne + islenen = 1_000_000`.

Hasat ve aktarım işlemleri merkezi durum üzerinden tek ana iş parçacığında doğrulanıp uygulanır. Görselleştirme ve UI sonradan olayı dinler. Hasat önce boş kapasite ve geçerli hedef sayısına göre sınırlandırılır. Hücre ilk başarılı işlemde işaretlenir, aynı hücreyi ikinci işlem alamaz. Botların görsel rota rezervasyonları yalnızca ipucudur. İşlem anında hücre yeniden doğrulanır.

**Sabit adım sırası:** Her 0,25 sn simülasyon adımında önce bekleyen oyuncu komutlarını sırayla uygula. Sonra botların söküm/teslimat kararlarını, sonra öğütmeyi çalıştır. Motorlu ekipmanın hız ve alan sorgusu da işlem kuyruğuna girer. Kesirli öğütme/söküm hızının artığı bir sonraki adıma kalır, boşta geçen adımlar geleceğe üretim hakkı biriktirmez. Oyun duraklatılınca adım çalışmaz. Kayıt yüklendiğinde gerçek dünya saatine göre ilerleme eklenmez.

Örnek sınır durumu: Oyuncunun çantasında 16 havuç var ve haznede 4 yer kaldı. E ile 4 havuç aktarılır. Çantada 12 kalır. Öğütücü bu adımda 2 havuç işlerse 2 XP ve o 2 havucun parasını verir. Tarladaki hücre sayısı bu iki aktarımda değişmez.

### Kayıt sistemi

Başlangıç için tek kampanya yuvası ve bir yedek. Kayıt dosyasında şema sürümü, katalog sürümü, dünya tohumu, bit dizisi, aktif parsel, çanta/kasa/hazne, işlenen sayı, bakiye, toplam kazanç, toplam XP, alınan ve harcanan puanlar, ekipman ID’leri, bot listesi/yükleri, oyuncu konumu ve kampanya süresi tutulur. Kullanıcı ayarları kampanya kaydından ayrıdır.

- Otomatik kayıt 60 saniyede bir, parsel açıldığında, önemli satın almadan ve zaferden sonra. Yalnızca simülasyon adımı sonunda anlık görüntü al.
- Geçici dosyaya yaz, doğrula, eski kaydı yedekle ve sonra yenisini değiştir. Hata varsa mevcut sağlam kaydı silme.
- Kayıt açılışında bit dizisi uzunluğunu, alan sınırlarını, ID’leri ve havuç değişmezini denetle. Geçersizse yedeği dene. Yedek de geçersizse açık hata göster ve yeni oyunu mevcut dosyaların üzerine otomatik yazma.
- Botların animasyon konumu zorunlu kayıt verisi değildir. Yük ve görev durumu korunur. Yüklemeyle sıfırdan çizilen bot, yükünü bir kez teslim eder.
- Oyuncu konumu uygun değilse en yakın servis yuvasına al. Oynama süresi duraklatma ve kapalı zamanı içermez.

## 11. Codex için yapım sırası

Her aşamayı ayrı görev olarak uygula. Aşama sonunda neyin değiştiğini, hangi testlerin çalıştığını ve Unity içinde hangi adımların kullanıcı tarafından doğrulanması gerektiğini yaz. Depoda zaten bir oyun varsa kapsam dışı sahne ve dosyaları değiştirme.

| Aşama | Yapılacak iş | Bitti sayılması için |
|---|---|---|
| 0 · Projeyi incele | Unity sürümü, render pipeline, sahneler, girdi ve test düzenini tespit et. README’ye mimari kararları yaz | Kurulu sürüm ve çalıştırma yolu belgeli. Proje açılıyor veya eksik bağımlılık somut biçimde belirtilmiş |
| 1 · İlk oynanabilir döngü | Tek test parseli, birinci şahıs hareket, elle hasat, 6’lık çanta, öğütücü, para ve XP HUD’u | Havuç 1 kez sökülür, E ile dökülür, yalnızca işlenince +1 ₵ / +1 XP alınır |
| 2 · Katalog ve büyüme | İlk aletler, kovalar, öğütücü kademeleri, mağaza, XP eşikleri ve beceri puanları | Oyuncu ilk kazmayı satın alır, 3’e kadar havuç söker, iki farklı beceri etkisini görür |
| 3 · Gerçek tarla | 100 parsel, bit dizisi, görünürlük parçaları, servis yuvaları ve kayıt | 1.000.000 benzersiz hücre doğrulanır. Kaydet/yükle sonrasında sökülmüş hücreler geri gelmez |
| 4 · Otomasyon | Bot toplama/teslimat döngüsü, hazne geri basıncı, filo, bant ve traktör | Bot ve oyuncu aynı hücreyi alamaz. Hazne doluyken bot yükünü korur ve yer açılınca teslim eder |
| 5 · Kampanya | Tüm katalog, son havuç takibi, final, erişilebilir ayarlar ve ses/görsel geri bildirim | Küçük test dünyası uçtan uca kazanılır. Tam dünyada sayaç ve final koşulu değişmez |
| 6 · Denge ve dağıtım | 3 rota simülasyonu, ilk 20 dk testleri, tam koşular, performans, Windows build | Süre ölçümü raporlanır. Temiz kurulumda oyun başlar, kayıt çalışır, tamamlanabilir build alınır |

**Geliştirici test modu:** Yalnızca Editör veya geliştirme derlemesinde küçük dünya, belirli ilerleme anına yükleme, sabit simülasyon tohumu ve hızlı zaman adımı sun. Tam sürümde hile düğmeleri görünmesin. Küçük dünya için değişmez kuralın sağ tarafı test kampanyasının hedefi olur. Üretim kampanyasının sabiti daima 1.000.000’dir.

## 12. Kabul testleri ve yayın ölçütleri

| Test | Beklenen sonuç |
|---|---|
| Yeni oyun | Tam 1.000.000 toprakta, diğer bütün havuç sayaçları 0. El ve 6’lık çanta hazır |
| Aynı hücreyi iki kez hasat | İkinci işlem 0 verir. Para ve XP artmaz |
| Son boş yeri doldur | 24 hedefli aletle boş yer 1 ise sadece 1 canlı hücre sökülür |
| Yanlış hedef veya yarım hasat | Menzil dışında veya eylem bitmeden iptalde ürün yok |
| Hazne doluyken dök | Hazne aşılmaz. Kalan çantada ya da bot yükünde tutulur |
| Oyuncu ve bot çakışması | Havuç tek bir tarafa gider. Kampanya toplamı korunur |
| Bir adımda çok XP | Geçilen her eşikten bir puan. Aynı eşik ikinci kez puan vermez |
| Yetersiz para ve kilitli ürün | Alım başarısız, bakiye ve ekipman değişmez |
| Tam kapasite düşürme | Beceri sıfırlamada mevcut yük silinmez. Yalnızca yeni ekleme sınırlandırılır |
| Tasarruf rotası | Oyuncu hiçbir otomasyon satın almasa bile mevcut alet ve öğütücüyle bitirebilir |
| Parsel ve kayıt | Parsel yalnızca boşalınca açılır. Kilitler ve bot yükleri yeniden açılışta doğru |
| Bozuk ana kayıt | Sağlam yedek denenir. İkisi de bozuksa sessiz veri kaybı yok |
| Son havuç çantada | Toprak 0 olsa bile zafer yok. Son öğütme ile zafer bir kez açılır |
| Tekrarlı kayıt yükleme | Öğütülen havuçlardan ikinci kez para veya XP alınmaz |
| Performans | Yoğun sahne ölçülmüş ve hedef donanım ile kalite ayarı belgelenmiş |
| Tam kampanya | İlk rota 120–180 dakika hedefiyle karşılaştırılmış, sapma ve ayar değişikliği yazılmış |

Öncelikli ölçüt, bir milyon havucun muhasebesinin bozulmamasıdır. İkinci ölçüt, ilk el hasadının tatmin edici ve ilk otomasyona geçişin anlaşılır olmasıdır. Üçüncü ölçüt, otomasyonun oyuncunun yerini tamamen aldığında bile oyuncuya darboğaz seçimi ve filo yönetimi için anlamlı kararlar bırakmasıdır.

## 13. Codex’e verilecek ilk komut

Aşağıdaki komut, doküman proje köküne kopyalandıktan sonra doğrudan kullanılabilir.

> Proje kökündeki Milyon_Havuc_Oyun_Tasarim_ve_Gelistirme_Dokumani.md dosyasını oku. Bu dosya Milyon Havuç oyununun tasarım kaynağı. Önce mevcut Unity projesini ve AGENTS.md talimatlarını incele. Kapsam dışı dosyaları değiştirme. Bu görevde yalnızca Aşama 0 ve Aşama 1’i tamamla. Birinci şahıs hareket, yerdeki havuca bakıp sol tuşu basılı tutarak tek havuç sökme, 6 kapasiteli çanta, E ile öğütücüye aktarma ve öğütülen havuç başına +1 para/+1 XP döngüsü çalışsın. Placeholder görseller kullan. Bu aşamada dükkân, bot, bir milyon havucun görseli veya tam harita yok. Hasat, çanta, hazne ve öğütme kurallarını test edilebilir sınıflarda tut. En az çift hasat, dolu çanta, kısmi boşaltma ve ödülün yalnızca öğütmeden gelmesi için test ekle. Çalıştırabildiğin testleri çalıştır. Unity Editörü bu ortamda yoksa çalıştırmadığın testleri ayrı yaz ve Unity’de nasıl doğrulayacağımı adım adım belirt. Sonuçta değişen dosyaları ve sahneyi açıp ilk hasadı nasıl deneyeceğimi göster. Sonraki aşamaya kendiliğinden geçme.

Bir sonraki görev için örnek: “Dokümandaki Aşama 2’yi uygula. İlk döngüyü bozma. Katalog ve beceri verilerini tek yerde tut. Aşama 1 testlerini tekrar çalıştır. Kazma ve kovanın oyun içinde nasıl satın alındığını doğrula.”

## 14. Sabit kararlar ve değiştirilebilir değerler

**Korunacak kararlar:** Tam 1.000.000 havuç. Elle tekli başlangıç. Öğütücünün arkada başlaması. Ödülün öğütme anında verilmesi. Parayla ekipman, XP’den gelen puanla beceri. Sonlu kampanya ve tam işlenmiş sayı ile zafer.

**Testten sonra ayarlanacaklar:** Ürün fiyatları, açılış eşikleri, bot teslimat süreleri, alet kapsama alanları, ilk sıranın makineye uzaklığı, hareket hızı ve işleme kapasiteleri. Bu rakamları değiştirmek için ayrı oyun kodu yazma. Katalog verisinden değiştir, simülasyon ve en az bir kısa oynanış testini yeniden çalıştır, sonucu denge notuna kaydet.
