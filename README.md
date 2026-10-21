# Özel Eğitim Yönetim Sistemi

Özel eğitim kurumlarının Excel ile yürüttüğü işleri tek yerde toplayan web uygulaması: öğrenciler ve veliler, öğretmenler, ders programı, veli ödemeleri, öğretmen hakedişleri ve raporlar.

## Neler var

- **Öğrenciler ve veliler** — kayıt, bağlı veliler, ders geçmişi, cari hesap (borç / ödeme / devir)
- **Öğretmenler** — eğitim türüne göre ders ücreti, ders başı / maaşlı / maaş + kota / yüzdelik hakediş, ödemeler ve avanslar, öğretmen birleştirme
- **Dersler** — haftalık plan, takvim, 40 dakikalık ders ve blok ders, mola süresi, çakışma kontrolü
- **Finans** — veli ödemeleri ve makbuz numarası, alacaklar, öğretmenlere ödenecekler
- **Raporlar** — finans, ders, öğretmen ve öğrenci raporları; Excel (CSV) olarak indirme ve yazdırma
- **Excel'den aktarma** — herhangi bir Excel dosyasını sütun eşleştirerek alma, devir tarihi, önizleme ve geri alma
- **Yedekleme** — yedek dosyası alma / geri yükleme, günlük otomatik yedek ve bilgisayardaki bir klasöre yedek (Chrome / Edge)

## Önemli: veriler nerede duruyor

Giriş bilgileri sunucuda (Neon veritabanı) durur. Öğrenci, ders ve ödeme kayıtları ise şimdilik **kullanılan tarayıcının içinde** saklanır:

- Farklı bilgisayarlar veya tarayıcılar birbirinin verisini görmez.
- Tarayıcı verisi silinirse kayıtlar da gider. Bu yüzden **Ayarlar → Yedekleme ve Excel → Yedek Al** ile düzenli yedek alın.

Sunucuya geçiş planı: [docs/BACKEND.md](docs/BACKEND.md).

## İlk açılış

Hazır bir hesap yoktur. Siteyi ilk açan kişi **Kurulum** ekranında kurum adını ve telefonunu, kendi adını, kullanıcı adını ve şifresini girer. Ardından paneldeki **Başlarken** adımları sırayla yol gösterir. Bilgiler sonra Ayarlar ve Profil sayfasından değiştirilebilir.

## Geliştirici

Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui (Base UI), Recharts, SheetJS, Vitest.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Komut | Görevi |
|---|---|
| `npm run dev` | Geliştirme sunucusu |
| `npm run build` | Canlı sürüm derlemesi |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript kontrolü |
| `npm test` | Testler (Vitest) |

```text
src/
 ├── app/          # Sayfalar: (auth)/login, (app)/app/*
 ├── components/   # Sayfa bileşenleri ve ui/ temel parçalar
 ├── hooks/        # Ortak React hook'ları
 ├── lib/
 │   ├── auth/     # Tek hesaplı giriş ve şifre kuralları
 │   ├── backup/   # Klasöre yedekleme
 │   ├── data/     # Veri deposu (bugün tarayıcı) ve sunucu bağlantı noktası
 │   ├── helpers/  # İş kuralları: borç, hakediş, çakışma, Excel aktarımı
 │   └── settings/ # Kurum ayarları, varsayılanlar, doğrulama
 └── types/        # Ortak türler
```
