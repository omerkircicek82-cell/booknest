# Booknest AI

Ollama ile çalışan DeepSeek R1 için Türkçe, mobil uyumlu sohbet sitesi. Node.js 22+ gerekir; harici npm bağımlılığı yoktur.

## Aynı sunucuda çalıştırma

1. Ollama'yı kurup servisini başlatın ve `ollama pull deepseek-r1` çalıştırın. Donanımınıza uygun daha küçük bir etiket de seçebilirsiniz; `ollama list` ile tam adını öğrenin.
2. Bu dizinde `.env.example` dosyasını `.env` olarak kopyalayın. `OLLAMA_MODEL` değerini indirdiğiniz tam model adıyla eşleştirin. İnternete açmadan önce `ACCESS_PASSWORD` için güçlü, benzersiz bir parola ayarlayın. Parolayı Git'e eklemeyin.
3. `npm start` çalıştırın. Varsayılan port 3000, dinleme adresi 127.0.0.1'dir. Sitede masaüstünde sol alttaki ayarlar düğmesinden erişim parolasını girin. Mobilde üstteki ayarlar düğmesini kullanın.

Ollama'yı 127.0.0.1:11434 üzerinde tutun. Ollama portunu internete açmayın. Tarayıcı yalnızca site sunucusuyla konuşur; sunucu Ollama'ya bağlanır. `OLLAMA_URL` sunucu tarafında kullanılır.

## Yayınlama

Node sürecini systemd/PM2 gibi bir süreç yöneticisiyle çalıştırın; çalışma dizini bu depo olmalıdır. Alan adınızı sunucunuza yönlendirip Caddy veya Nginx ile HTTPS reverse proxy kurun. Caddy örneği (alan adını değiştirin):

```caddy
ai.example.com {
    reverse_proxy 127.0.0.1:3000 {
        flush_interval -1
    }
}
```

Nginx kullanıyorsanız yanıt tamponlamasını kapatın (`proxy_buffering off`) ve modelin düşünme süresine uygun okuma zaman aşımı belirleyin. Proxy, özgün Host ve Origin başlıklarını korumalıdır. Sadece HTTPS portlarını dışarı açın. Ortak parola kişisel/küçük özel kullanım içindir; herkese açık çok kullanıcılı hizmet için kullanıcı hesapları, kota ve hız sınırı eklenmelidir.

## Özellikler ve sınırlar

- Akış halinde yanıt, durdurma, yeni sohbet ve tarayıcıda yerel sohbet geçmişi.
- Ollama'nın ayrı `thinking` alanı geldiğinde açılır düşünme bölümü.
- Mesajlar düz metin gösterilir; HTML çalıştırılmaz. Markdown/kod biçimlendirme yoktur.
- Sohbet geçmişi bu tarayıcının localStorage alanında saklanır. Erişim parolası sekme oturumu boyunca sessionStorage içinde tutulur. Paylaşılan cihazlarda tarayıcı site verilerini temizleyin.
- Gerçek model yanıtı için sunucunuzdaki Ollama'nın çalışması ve seçilen modelin indirilmiş olması gerekir. Bulut geliştirme ortamı kişisel sunucunuza otomatik erişemez.

`npm test` HTTP sunucusunu geçici bir Ollama taklidiyle sınar; gerçek model kalitesini/donanımı doğrulamaz.

## Eğlence modu

Site adresinin sonuna `/eglence` ekleyin (yerelde `http://localhost:3000/eglence`). Yanıtlar “aptülfettah oğulları,” hitabıyla gösterilir ve modele samimi, eğlenceli bir üslup talimatı gönderilir. Bu modun sohbet geçmişi ayrı saklanır. Normal moda dönmek için `/` adresini açın. Bu bağlantı gizli erişim anahtarı değildir; mevcut erişim parolası burada da geçerlidir.

## Gizli ifade oyunu

`/game` adresinde oyun başlar. Mesaj gönderin veya ipucu isteyin; model cevapla birlikte ipucu verir. Gizli ifadeyi tek mesajda doğru yazınca o sohbette özel hitap biter. Büyük/küçük harf, fazla boşluk ve sondaki noktalama farkları kabul edilir. Yeni sohbet yeni oyun başlatır. Oyun geçmişi diğer modlardan ayrıdır. Bu bir eğlence oyunudur; model ipuçlarının gizliliği bir güvenlik mekanizması değildir.
