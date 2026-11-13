# Denge ölçümü — 13 Kasım 2026

Bu sonuçlar insan oynanışı değildir. Gerçek katalog ve Campaign kurallarıyla 0,25 sn adımda yürütülen deterministik modeldir. Her koşuda tam bir milyon havuç işlendi; son durum muhasebe doğrulamasından geçti.

| Politika | Dakika | El / bot / traktör | 120–180 dk hedefi |
|---|---:|---|---|
| aktif | 235.57 | 187,761 / 0 / 812,239 | Dışında |
| karma | 115.57 | 177,309 / 637,091 / 185,600 | Dışında |
| otomasyon | 104.3 | 329,316 / 670,684 / 0 | Dışında |

Ham kilometre taşları, alışveriş sırası/fiyatları, son bakiye, haznenin dolu/boş kaldığı süre ve son 1.000 kökün süresi [simulation-results.json](simulation-results.json) dosyasındadır.

## Varsayımlar ve sınırlar

- El eylemleri için %12 karar/okuma kesintisi; botlar bu modellenen boşlukta çalışır. Gerçek menü duraklamasının kampanya süresinden düşülmesiyle birebir aynı değildir.
- Teslim turu temsili 12 metre / yürüyüş hızı + 0,4 sn dökme; traktörde 9 m/s. Parsel geçişi 12 sn. Büyük parsellerdeki gerçek mesafeler modellenmedi.
- Aktif ve karma politika traktör satın alabilir; otomasyon rotası elde hasat ve bot kullanır. Alet alan geometrisi ve seyrek kalan kökler gerçek çekirdek kurallarıyla uygulanır.
- Alım politikaları beş saniyede bir ilk uygun öncelikli ürünü alır. Bu bir optimal rota çözücüsü değildir. Özellikle aktif rotada traktörün dar şeridi ve seyrekleşen kökler süreyi artırabilir.
- Sonuçları hedefe uydurmak için katalog fiyatları veya hızlar değiştirilmedi. Önce gerçek hareket/hasat kullanılabilirliği ve satın alma politikası doğrulanmalıdır.

## Gerekli sonraki ölçümler

Karma rota hedefin altında, aktif rota üstünde kaldı. İnsan oturumları yapılmadan 2–3 saatlik kampanya vaadi doğrulanmış sayılmaz. Önce Unity’de ilk hasat, yürüyüş ve alan seçimi test edilmeli; ardından üç yeni oyuncuyla ilk 20 dakika ve iki tam kampanya oturumu ölçülmelidir. Gerçek donanımda 1080p performansı henüz ölçülmedi.
