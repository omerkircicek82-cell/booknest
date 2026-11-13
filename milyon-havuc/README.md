# Milyon Havuç

Belgedeki sonlu hasat ve otomasyon oyununun bağımsız Unity projesi. Önceki Booknest web uygulaması değişmedi. Bu dizin Unity Hub'a **ayrı proje** olarak eklenir; `npm start` oyunu başlatmaz.

## Aç ve oyna

1. Unity Hub ile **Unity 6000.0.23f1**, Windows Build Support (Mono) modülünü kur. Bu sürüm proje için seçilmiştir; bulut makinesinde Unity kurulu değildir.
2. Hub → Add → bu `milyon-havuc` dizinini seç. Paket manifesti URP **17.0.3** kullanır. İlk açılış Unity paket kayıt sunucularına erişim gerektirir.
3. Derleme tamamlanınca `Milyon Havuç → Tarlayı aç` menüsüne bas. Editör betiği URP varlıklarını ve `Assets/Scenes/Farm.unity` sahnesini oluşturur, PC girdi ayarlarını yapar.
4. **Play → Yeni kampanya**. İlk havuca bakıp sol tuşu yaklaşık 0,55 sn basılı tut. Çanta 6'lık; hareket gerektirmeden ilk kök hedeflenebilir.
5. Fareyle arkana dön, öğütücüye yaklaş, **E** ile dök. Huniye aktarma ödül vermez; öğütülünce para ve XP artar. **Tab** ile mağaza/beceri/harita/filoyu aç.
6. **Esc** ile duraklat ve kaydet. Menüde otomasyon ve oyun süresi durur. Kayıtlar `Application.persistentDataPath` altında `milyon-havuc.json` ve `.bak` dosyalarıdır.

| Girdi | İşlev |
|---|---|
| WASD / Fare | Hareket / bakış |
| Shift | Koş |
| Sol tuş | Hasat; ayarlardan tıkla-aç/kapat seçilebilir |
| E | Dök, traktöre bin/in; boşaltma önceliklidir |
| 1 / 2 / 3 | El / en iyi mekanik alet / en iyi motorlu alet |
| Tab | Yönetim ekranları |
| Esc | Duraklat / devam |

## Uygulanan sistemler

- 100 yılan sıralı parsel × 10.000 benzersiz hücre, toplam tam **1.000.000 havuç**. Hasat bit dizisi **125.000 bayt**. Ödüller yalnızca öğütme sırasında, para kuruş cinsinden tam sayıyla hesaplanır.
- Birinci şahıs hareket, menzil/eylem iptali, kapasiteye göre kısmi alan hasadı, kısmi boşaltma, 0,25 sn sabit simülasyon adımı.
- Belgedeki 34 ürün, 30 XP eşiği, yedi beceri dalı ve ücretsiz yeniden dağıtım. Alımlar, açılış eşiği ve ön koşullar tek katalogdan gelir.
- Robot kopya fiyatları, 8 aktif yuva, yük/teslimat döngüsü, geri basınç, drone/rota etkisi, son 60 sn teslimat, garaja gönderirken yük koruma. Filo Kumandası işlem önceliğini değiştiren “Öne al” seçeneğini açar.
- Sürüş sırasında hasat eden basit traktör, araç kasası, mobil öğütücü ve bant girişi. Lastik fiziği ve yakıt yoktur.
- Parsel haritası, son kök yönü, son yüklerin nerede olduğuna dair sayaçlar, tam işleme ile zafer ve istatistik kartı.
- Şemalı kayıt doğrulama, geçici dosyaya yazma, sağlam önceki kaydı yedekleme, bozuk ana kayıtta yedeğe dönüş. Kapalı zamanda üretim yoktur.
- Prosedürel placeholder tarla, havuç, robot ve traktör modelleri, sentezlenmiş kısa sesler, fare/FOV/ses/hasat yöntemi/kamera hareketi ayarları.

## Mimari

`Assets/MilyonHavuc/Core` Unity'den bağımsızdır: `Catalog`, `Campaign`, `HarvestAction`, `SaveStore`. `Campaign` tüm ürün aktarımının tek kaynağıdır. Görsel model ve sesler muhasebeyi değiştirmez.

`Runtime/FarmGame` sahneyi ve IMGUI arayüzünü kurar. PC için Unity'nin klasik **Input Manager** yöntemi seçilmiştir; eksenler projeye eklenmiştir. Oyuncu komutları karede uygulanır, botlar ve öğütücü 0,25 sn adımlarında ilerler; tek ana iş parçacığı muhasebeyi seri tutar. Komutların tamamen sabit adım kuyruğuna alınması henüz uygulanmadı.

Havuç başına GameObject, collider veya Update yoktur. Yakındaki 20×20 çizim parçaları `DrawMeshInstanced` ile çizilir. Hasat olayı yalnızca etkilenen parçanın önbelleğini geçersiz kılar. Görünür mesafe 65 m; uzakta sıra şeritleri kalır. Bu yapı performans hedefidir, ölçülmüş 60 FPS garantisi değildir.

`Editor/ProjectSetup` URP/sahne oluşturma ve Windows derleme komutunu içerir. Materyaller çalışma anında oluşturulduğundan kullanılan shader'lar derleme listesinde korunur.

## Testler

.NET 8 SDK ile, bu dizinden:

```sh
dotnet run --project Tests/Rules.csproj
dotnet run --project Tests/Rules.csproj -- --simulate
```

Bulut ortamında SDK `/workspace/.milyon-tools/dotnet/dotnet` konumuna kuruldu. Gerektiğinde `DOTNET_CLI_HOME=/workspace/.milyon-tools` kullanılır. Testler harici test paketi gerektirmeyen, başarısızlıkta sıfırdan farklı çıkış kodu veren bir konsol koşucusudur. NUnit/Unity Test Runner testleri değildir.

**Doğrulandı:** 23 kural testi, küçük dünyada uçtan uca tamamlama, üç tam milyonluk deterministik ekonomi simülasyonu. Mevcut web uygulamasının iki testi de geçti. Runtime ve Core C# dosyaları ayrıca Unity 2021.3 referans derlemeleriyle sözdizimi/API kontrolünden geçti; bu, Unity 6 Editor derlemesi veya PlayMode testi yerine geçmez.

**Bu ortamda çalıştırılmadı:** Unity paket çözümlemesi, Editor betiğinin Unity 6'da derlenmesi, sahnenin gerçek oynanışı, grafik/ses davranışı, Windows build, hedef PC performansı, yeni oyuncu oturumları. Unity Editor ve lisanslı build ortamı bulunmadığı için bu proje henüz doğrulanmış Windows dağıtımı değildir.

Editör/geliştirme derlemesinde kayıt yokken ana menüde 10.000 köklük test dünyası seçeneği görünür. Üretim kampanyasının varsayılanı daima 1.000.000'dir. Daha küçük son-havuç senaryoları kurallar testlerinde 8 ve 400 hücreyle çalıştırılır.

### Unity içinde kabul kontrolü

- İlk kökü sök; tekrar aynı hücreyi dene. Yarım bırak veya uzağa bak: ürün gelmemeli.
- Altı kökte çanta dolmalı. Dökmeden para/XP olmamalı. Dökünce makine 4/s işlemeli.
- Küçük Kova ve El Kazması al; 16 kapasiteyi ve üçlü hasadı dene.
- Tab/Esc açıkken makine ve botlar durmalı; menüyü kapatınca devam etmeli.
- Kayıt al, Play'i durdur, yeniden aç; sökülmüş hücre ve ödüller geri gelmemeli.
- Bir bot al, yükünün doluşunu, teslimata dönüşünü ve hazne doluyken bekleyişini gözle.
- 8 bot + traktör + fabrika hattı sahnesini Profiler ile ölç. 1080p hedef PC bilgilerini ve FPS/tahsis değerlerini kaydet.
- Küçük dünyayı son işleme kadar tamamla; tarlanın boşalması tek başına zafer vermemeli.

## Windows derlemesi

Unity'de `Milyon Havuç → Windows x64 derle`. Çıktı `Builds/Windows/MilyonHavuc.exe`. Unity Hub'da Windows Build Support modülü kurulu olmalıdır. Komut satırı alternatifi:

```sh
Unity -batchmode -quit -projectPath /tam/yol/milyon-havuc \
  -executeMethod MilyonHavuc.Editor.ProjectSetup.BuildWindows -logFile build.log
```

Derleme sonucu kontrol edilir; başarısız rapor hata üretir. Bu komut mevcut bulut ortamında çalıştırılmadı.

## Kalan ürün işi

Bu sürüm bir geliştirme prototipidir. İnsan oynanış testleri, Unity 6 sahne doğrulaması, Windows dağıtımı ve performans ölçümü tamamlanmalıdır. [Denge raporu](docs/BALANCE.md) simülasyonun varsayımlarını ve hedef süreden sapmaları açıklar. Botların görsel hareketleri basit hedef takibidir; gerçek yol/şerit navigasyonu ve görsel taşıma animasyonları placeholder düzeyindedir. Bölgelerin kimliği toprak rengiyle sınırlıdır. Serbest bina yerleştirme, ekim ve çevrimdışı üretim kapsam dışıdır.

## Tarla günlüğü güncellemesi

- 12 başarım: ilk kök, ilk kazanç, ilk ekipmanlar, ilk robot, parsel temizliği, filo ve kampanya finali. Rozetler mevcut kayıt sayaçlarından türetilir; para, XP veya ekstra havuç üretmez. Eski kayıtta açılan rozetler görünür, bildirimler tekrar oynatılmaz.
- HUD üzerinde ilerlemeye göre değişen hedef rehberi ve hasatta toplanan miktar bildirimi.
- Tab → Tarla günlüğü: son 60 saniyeye kadar işleme hızı, dakikalık gelir, dolu hazne/boş öğütücü teşhisi ve başarım kartları. Pencere yalnızca oynarken ilerler; kayıt açıldığında yeni ölçüm başlar.
- Mevcut projeye geçiş için depodaki `milyon-havuc-guncelleme.zip` yalnızca `FarmGame.cs` ve yeni `FarmJournal.cs` dosyalarını içerir. `Campaign.cs`, kişisel modeller ve materyaller pakette yoktur. Önce kendi projenin yedeğini al; Unity kapalıyken ZIP'in Assets klasörünü proje kökündeki Assets ile birleştir. FarmGame.cs üzerinde kendi değişikliklerin varsa bu dosyayı doğrudan değiştirmek yerine farkları birleştir.
- Eklenen altı test ile toplam 23 kural testi geçti; referans derlemeleriyle C# kontrolü hatasız. Unity 6 görsel doğrulaması bu ortamda henüz yapılamadı.
