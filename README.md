# GIB XML PDF Donusturucu

GIB e-Fatura/e-Defter XML dosyalarini tarayici icinde on izleyip PDF olarak indirmek icin statik web uygulamasi.

## Ozellikler

- XML ve ZIP icindeki XML dosyalarini destekler.
- GIB XML icindeki gomulu XSLT sablonunu kullanarak on izleme uretir.
- XSLT bulunamazsa temel e-Defter berat gorunumu veya ham XML gorunumu olusturur.
- PDF olusturma ve indirme islemi kullanicinin tarayicisinda yapilir.
- Yuklenen dosyalar sunucuya gonderilmez, diske kaydedilmez ve yalnizca sayfa acik kaldigi surece tarayici belleginde tutulur.

## Gizlilik

Bu proje Vercel gibi statik barindirma servislerinde PHP, veritabani veya dosya kaydi kullanmadan calisacak sekilde duzenlenmistir. Uygulama tarafinda `fetch` ile dosya gonderimi yoktur; eski `save.php` ve `saved_pdfs/` akisi kaldirilmistir.

Not: Sayfa, arayuz ve PDF uretimi icin CDN uzerinden sabit surumlu ve SRI hashli ucuncu taraf kutuphaneler yukler. Hassas ortamlar icin bu kutuphaneleri yerel olarak vendor edip CSP kaynaklarini buna gore daraltabilirsiniz.

## Yerelde Calistirma

Build adimi gerekmez. `index.html` dosyasini dogrudan acabilir veya basit bir statik sunucu kullanabilirsiniz:

```bash
npx serve .
```

## Vercel'e Yayina Alma

1. Bu klasoru GitHub reposu olarak yayinlayin.
2. Vercel'de yeni proje olusturup GitHub reposunu secin.
3. Framework preset olarak `Other` veya statik varsayilani kullanin.
4. Build command ve output directory alanlarini bos birakin.

`vercel.json` dosyasi statik dagitim icin temel guvenlik basliklarini ve temiz URL ayarini icerir.

## Guvenlik Notlari

- On izleme iframe'i sandbox'lidir.
- XML/XSLT ciktisindaki script, iframe, form ve inline event handler gibi aktif icerikler temizlenir.
- Content Security Policy, uygulamanin dosya upload etmesini veya uzak kaynaklara veri gondermesini engelleyecek sekilde daraltilmistir.
- ZIP icindeki XML sayisi ve tek dosya boyutu tarayici performansi icin sinirlandirilmistir.

## Lisans

MIT. Ayrinti icin [LICENSE](LICENSE) dosyasina bakin.
