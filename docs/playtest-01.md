# Playtest 01 — Prototip + GDD v0.2 ekonomi analizi

Tarih: 2026-10-04 · Kapsam: tıklanabilir prototip (4 dk gerçek oynanış, Playwright ile)
ve GDD v0.2 sayılarıyla sıfırdan 6 saatlik ekonomi simülasyonu (`greedy` oyuncu:
her saniye en iyi oranlı alımı yapar).

**Kısa hüküm:** His doğru. Oyun hem çok kolay hem kopuk, çünkü:
1. Tasarımın merkezinde **bir gerilim (karar) yok.** Her şey "+X/s veren kart" ve
   en ucuzunu almak her zaman doğru.
2. Sistemler bir **özellik listesinden** eklendi, birbirini etkilemiyor.
3. Büyüme eğrisi **plato → patlama** şeklinde. Ne duvar var ne de prestije sebep.
4. Tema sadece **kaplama**. "Yazılım şirketi" fikri hiçbir mekaniğe dönüşmemiş.

---

## 1. Ölçümler

### 1.1 Ekonomi simülasyonu (GDD v0.2 sayıları, sıfırdan)

| An | LoC/s | Tıklamanın payı | $/s | Durum |
|---|---|---|---|---|
| 1 dk | 2.5 | %67 | 4 | Garajda 5 koltuk. Sadece Intern alınabiliyor |
| 5 dk | 6 | %45 | 28 | İlk Junior 5. dakikada, ofis taşındıktan sonra |
| 10 dk | 43 | %10 | 143 | |
| 30 dk | 704 | %0.7 | 877 | 100 koltuğa takılı |
| 60 dk | 1.9K | %0.3 | 22K | **35 dakikalık plato** (koltuk sınırı) |
| 120 dk | **1.5M** | 0 | **4.4M** | **1 saatte ×800 patlama** |
| 6 sa | 61M | 0 | 1.3B | Hiç duvar yok |

- **$1M (Exit eşiği): 35. dakika · $1B (IPO eşiği): 109. dakika** — prestij yapmadan.
- **Tıklama 10. dakikadan sonra anlamsız:** 10 dakika tıklayıp bırakan oyuncu ile
  sürekli tıklayan oyuncu $1M'a aynı anda ulaşıyor (35:20 vs 34:50).
- **Alımlar arası süre hiç uzamıyor:** medyan 4–15 sn, en uzun bekleme 2 dk 16 sn.
  Oyuncu hiç "takılmıyor", dolayısıyla Exit yapmak için hiçbir sebep yok.
- Patlamanın nedeni: (a) kilometre taşı ×2 yükseltmeleri çok ucuz (100 Intern
  için ×2 sadece $15K), (b) `1 + √Rep/100` sınırsız ve Rep kendi kendine büyüyor
  (6. saatte ×90), (c) LoC ve $ döngüsü birbirini çarpıyor.

### 1.2 Prototipte 4 dakika gerçek oynanış

- Açılışta 1.26K LoC, $889 ve 8 sekmenin tamamı görünüyor. **Keşif hissi sıfır.**
- **12. saniyede** ofis doluyor. Sonraki **4 dakika LoC hızı 59/s'de sabit**,
  para **$48K'ya birikiyor ve harcanacak hiçbir şey yok** (ofis taşıma çalışmıyor).
- Tıklama +1 LoC, otomatik üretim 56/s → tek tık üretimin **%1.7'si**.
- Kontrat ödülü ($2.5K) yaklaşık **40 saniyelik gelir** ediyor. Fark edilmiyor bile.
- Rep pasif olarak artıyor, kilitler kendiliğinden açılıyor. **Oyuncunun bir payı yok.**
- Contracts / Research / Office sekmeleri statik görsel. Oynanışa bağlı değiller,
  bu da "kopukluk" hissinin doğrudan sebebi.
- Görsel hata: editördeki kod satırları kelime kelime alt satıra kırılıyor
  (`pre` flex kolonu). Bu küçük hatalar "özensiz/slop" hissini büyütüyor.

---

## 2. Türün iyi örnekleriyle karşılaştırma

| Oyun | Ne yapıyor | Bizde durum |
|---|---|---|
| **Universal Paperclips** | Arayüz yavaş yavaş açılıyor. Her "proje" oyunun kuralını değiştiriyor. Fiyat/talep ayarı sürekli bir karar. | Her şey ilk saniyede açık. Hiçbir alım kuralı değiştirmiyor. |
| **Cookie Clicker** | Tıklama, "CpS'nin %'si" yükseltmeleri ve golden cookie ile hep anlamlı. Binaların kendine özgü mini oyunları var. Yumuşak duvarlar prestiji tetikliyor. | Tıklama 10. dakikada ölüyor. Duvar yok. |
| **Antimatter Dimensions** | Katmanlar birbirini üretiyor, büyüme hissediliyor. 1.8e308'de **sert duvar** var, prestij zorunlu ve heyecanlı. | Katmanların hepsi aynı oranda ve birbirinden bağımsız. |
| **Kittens Game** | Depolama sınırları ve kaynak dengesi gerilim yaratıyor. | Ofis sınırı tek gerilim, o da sadece "bekle" demek. |
| **A Dark Room / Candy Box** | Hikâye ve mekanik birlikte açılıyor. Her yeni sekme bir sürpriz. | 8 sekme baştan "NEW" etiketiyle duruyor. |
| **Adventure Capitalist** | Yöneticiler (otomasyon), tıklama işini zamanla elinden alıyor ve bu bir ödül gibi hissettiriyor. | Otomasyon baştan var. Tıklamanın yerini alan bir ödül anı yok. |

Ortak ders: iyi incremental oyunlar **(1) neyin açılacağını saklıyor,
(2) her birkaç dakikada oyuncuya gerçek bir karar veriyor, (3) büyümeyi bilerek
yavaşlatıp prestiji bir kurtuluş gibi hissettiriyor.** Bizde üçü de yok.

---

## 3. Kök nedenler

1. **Tasarım bir özellik menüsünden doğdu.** "Kontrat? Araştırma? Ofis?" diye
   seçildi. Her sistem ayrı tasarlandı, hiçbiri ortak bir kaynak ya da gerilim
   etrafında dönmüyor. (Bu sorunun kaynağı benim yönlendirme şeklim.)
2. **Temaya özgü tek bir mekanik yok.** Şu an "Intern", "Cookie Clicker'daki Cursor"
   ile aynı şey. Yazılımın gerçek gerilimi var ama kullanılmamış:
   **hız ↔ kalite (teknik borç / bug)**, **yaz ↔ yayınla (ship)**.
3. **Kaynak dönüşümü pasif.** LoC kendiliğinden birikiyor, ürünler kendiliğinden
   para basıyor. "Ship" yani yayınlamak, bir oyuncu fiili olarak hiç yok.
4. **Sayılar duvarsız.** Ucuz ×2'ler, sınırsız Rep çarpanı ve çapraz döngü
   birleşince sonsuz büyüme ortaya çıkıyor.

---

## 4. Öneri yönü (karar senin)

**A. Merkezî gerilim: Teknik borç (Tech Debt).** Yazılan her LoC bir miktar borç
üretiyor. Ucuz/hızlı eleman (Intern) çok borç üretiyor, Senior az. Borç büyüdükçe
gelir düşüyor ve "Production Bug" olayları sıklaşıyor. Oyuncu sürekli şu kararı
veriyor: **hızlı büyü mü, refactor yapıp temizle mi?**
- Araştırma ağacı borcu azaltan araçları açıyor (CI/CD, testler, Docker).
- Kontratların kalite şartı var ("max %20 borç").
- Moral düşünce borç artıyor (crunch).
- Exit = "borçlu kod tabanını satıp temiz başla". Prestijin hikâyesi kendiliğinden oluşuyor.

**B. "Ship" fiili.** LoC kendiliğinden paraya dönmüyor. Biriken özellikleri
**Release** butonuyla yayınlıyorsun. Büyük release daha çok kazandırıyor ama
daha çok bug taşıyor. Ritmik ve aktif bir eylem, tıklamanın ötesinde bir karar.

**C. Kademeli açılış.** Başta sadece editör var. İlk $10'da Products, ilk
release'te Team, ilk bug'da Research… Her sekme bir "aha" anı oluyor.

**D. Bilerek tasarlanmış duvarlar ve hedef tempo.**
- Alımlar arası süre ilk 5 dakikada ~5 sn, 30. dakikada ~60 sn, duvarda 3–5 dk.
- Rep çarpanı logaritmik ve tavanlı. ×2'ler pahalı.
- İlk Exit yaklaşık 30–40. dakikada, büyüme belirgin şekilde yavaşlamışken.

**E. Tıklama hep anlamlı.** Tıklama = "focus": art arda tıklama bir *flow*
çarpanı biriktiriyor, refactor'ı hızlandırıyor, bug'ları elle düzeltmeye yarıyor.

**F. Daha az ama derin sistem.** Ofis ayrı sekme olmaktan çıkıp Team'in içine
giriyor. Her sistem yukarıdaki gerilime (borç, release, flow) bağlanıyor.
