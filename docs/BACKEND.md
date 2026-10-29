# Sunucu (Backend) Rehberi

Bu belge sistemi geliştirecek kişi içindir. Site Vercel'de çalışır; giriş bilgileri ve kurumun bütün kayıtları **Neon Postgres** veritabanındadır. Bağlantı adresi `DATABASE_URL` ortam değişkenindedir (Vercel ↔ Neon entegrasyonu ayarlar; geliştirme için `npx vercel env pull .env.local`). Tablolar ilk istekte kendiliğinden oluşur.

## 1. Yapı

| Katman | Dosya | Görevi |
|---|---|---|
| Veri kaynağı | `src/lib/data/source.ts` → `server-source.ts` | Verinin sunucuyla eşitlenmesi: `load`, `save`, `flush`, `watch`. |
| Birleştirme | `src/lib/data/merge.ts` | İki cihaz aynı anda kaydedince değişiklikleri kayıt kayıt (`id` ile) birleştirir. Testli. |
| Uygulama durumu | `src/lib/data/store.tsx` | Tüm kayıtlar ve onları değiştiren eylemler. Sayfalar veriye yalnızca `useStore()` ile ulaşır. Giriş yapılmadan yüklenmez. |
| İş kuralları | `src/lib/helpers/*.ts` | Borç, öğretmen hakedişi, devir, Excel aktarımı, çakışma kontrolü. Tarayıcıda çalışır, testli. |
| Kimlik doğrulama | `src/lib/server/auth-core.ts`, `src/app/api/auth/*`, `src/app/api/setup`, `src/app/api/staff` | Yönetici ve personel hesabı, şifre, oturum (bkz. Bölüm 5). |
| Personel görünümü | `src/lib/server/staff-view.ts`, `src/lib/auth/access.ts` | Personelin göreceği/değiştirebileceği veri (sunucuda) ve ekranlar. |
| Veri uç noktaları | `src/app/api/state`, `src/lib/server/state-repo.ts` | Kurumun verisi (aşağıda). |
| Yedekler | `src/lib/data/persistence.ts`, `src/lib/backup/backup-folder.ts` | Yedek dosyası, tarayıcıda günlük otomatik yedek, klasöre yedek. |

## 2. Veri nasıl saklanıyor

**Bugün (Aşama 1):** Kurumun bütün verisi `app_state` tablosunda tek satırda, `jsonb` olarak durur; yanında bir `version` sayısı vardır.

- `GET /api/state` → `{ data, version }` (gzip). `GET /api/state/version` → yalnızca sürüm (cihazlar 8 saniyede bir sorar).
- `PUT /api/state` gövdesi `{ data, baseVersion }` (gzip). Sürüm tutuyorsa kaydedilir ve sürüm bir artar. Tutmuyorsa `409` ile güncel veri döner; tarayıcı kendi değişikliklerini onun üstüne birleştirip (`merge.ts`) yeniden gönderir.
- Gövdeler gzip'li gider gelir; Vercel'in 4,5 MB istek sınırına bu sayede uzun süre takılmaz.
- Her istek oturum çerezi ister; veri değiştiren istekler yalnızca sitenin kendi sayfalarından kabul edilir (`isSameOrigin`).
- Değişiklikler 0,4 sn bekletilip toplu gönderilir. Kaydedilemezse üstte uyarı çıkar, 5 sn'de bir yeniden denenir; gönderilmemiş değişiklik varken sekme kapatılırsa tarayıcı uyarır.

**Eş zamanlı düzenleme:** İki cihaz aynı kaydı düzenlerse değişiklikler alan alan birleşir; ikisi aynı alanı değiştirdiyse sonra kaydedenin değeri kalır. Aynı anda verilen makbuz/öğrenci numarası çakışırsa sonra kaydedene sıradaki boş numara verilir.

**Aşama 2 (ileride):** Veri çok büyüyünce (on binlerce ders) her kayıt türü ayrı tabloya ve ayrı uç noktalara ayrılır; numaralar veritabanı dizisinden verilir.

## 3. Veri modeli

Tüm türler `src/types/index.ts` ve `src/types/settings.ts` içindedir. Her kayıtta `id` (metin, `createId` ile üretilir), `tenantId`, `createdAt` ve çoğunda `updatedAt` bulunur. Tarihler ISO 8601 metindir; yalnızca gün olan alanlar `YYYY-MM-DD`, ders saatleri yerel saattir (`2026-10-06T10:00:00`, saat dilimi eki **yok**; kurum Türkiye saatinde çalışır).

| Tablo | Önemli alanlar | İlişkiler |
|---|---|---|
| `students` | `fullName`, `birthDate`, `status` (active / inactive / on_hold), `studentNumber`, `kvkkConsent`, `guardianName?`, `guardianPhone?` | `educationTypeIds[]` → education_types |
| `teachers` | `fullName`, `status` (active / inactive / archived), `earningType`, `monthlySalary`, `includedSessionQuota`, `extraSessionEarning`, `earningPercentage`, `leftAt`, `openingBalance` | `mergedIntoTeacherId` → teachers |
| `education_types` | `name`, `defaultStudentPrice`, `color`, `status` | — |
| `teacher_education_type_assignments` | `earningAmount` (ders başı öğretmen ücreti; `null` = tanımlanmamış), `status` | teacher, education type |
| `sessions` (dersler) | `date`, `durationMinutes`, `sessionCount` (blok ders = 2), `studentPrice`, `teacherEarning`, `status`, `billingMode`, `earningFactor`, `teacherEarningStatus` | student, teacher, education type, `weeklyPlanId`, `importBatchId` |
| `payments` (veli ödemeleri) | `amount`, `method`, `date`, `receiptNumber`, `historical` | student |
| `teacher_payments` | `amount`, `paymentType` (salary / advance / partial / bonus / deduction / other), `method`, `date`, `historical` | teacher |
| `opening_balances` (öğrenci devri) | `amount` (her zaman pozitif), `balanceType` (debt / credit), `date` | student |
| `weekly_session_plans` | `weeklySchedule[]`, `startDate`, `endDate`, `studentPrice`, `teacherEarning` | student, teacher, education type |
| `import_batches` | `fileName`, `createdEntityIds`, `fileFingerprint`, `rolledBackAt` | Excel aktarımını geri almak için gerekir |
| `teacher_merge_history` | `snapshot`, `moved`, `rolledBackAt` | Öğretmen birleştirmeyi geri almak için gerekir |
| `institution_settings` | Tek satır; bölümleri `src/types/settings.ts` | — |
| `teacher_earnings` | Derslerden **türetilir** (`upsertEarningForSession`). Saklanması zorunlu değil. | session, teacher |
| `notifications` | Uygulama üretir; cihaz/kullanıcı bazlı tutulabilir. | — |

## 4. Sunucunun bozmaması gereken kurallar

Bu kurallar bugün uygulamada uygulanıyor ve testli (`npm test`). Sunucu veriyi değiştirecekse (Aşama 2) aynılarını korumalı:

- **Borç:** `completed`, `no_show` ve `makeup` dersler borç yazar; `planned` ve `cancelled` yazmaz. `billingMode = "historical_non_billable"` ders hiçbir hesaba girmez (Excel'den gelen geçmiş kayıt; bakiyesi devirde). → `isBillableSession`
- **Öğretmen payı (`earningFactor`) ders kaydedildiği anda damgalanır.** Ayar sonradan değişse de eski dersin payı değişmez. Varsayılan: gelmedi = 0, iptal = 0, telafi = tam. → `computeEarningFactor`, `store.addSession/updateSession`
- **Ücretsiz telafi:** Ayar "ücretsiz" iken telafiye dönen dersin ücreti 0 yapılır (formdan, Excel'den, plandan). → `applyMakeupBilling`
- **Maaşlı öğretmen:** Başladığı aydan (ilk ders / devir / kayıt) bugüne kadar, ayrıldıysa ayrıldığı aya kadar her ay maaş yazılır; dersi olmayan ay da sayılır. Birleştirilmiş (`archived`) kayda maaş yazılmaz. → `getSalaryPeriodRange`
- **Avans:** Fazlası sonraki aylardan düşülür (önceki devir eksiye düşebilir). → `getTeacherMonthAccountSummary`
- **Makbuz numarası** `MKB-<yıl>-<sıra>` biçiminde, 1000'den başlar; geçmiş kayıt ödemesine numara verilmez. Sunucuda bu sıra **tek yerden** (veritabanı dizisi) verilmeli, yoksa iki cihaz aynı numarayı üretebilir.
- **Öğrenci numarası** (`OGR-0001`…) da aynı şekilde tek yerden verilmeli.
- **Çakışma:** Aynı öğretmene veya öğrenciye aynı saatte iki ders verilmez; aradaki mola ayarlıdır. → `session-conflict.ts`

## 5. Hesaplar ve kimlik doğrulama

- **İki hesap:** `account` tablosunda id 1 = yönetici (ilk kurulumda oluşur, tam yetki), id 2 = isteğe bağlı **personel** hesabı (yönetici Ayarlar → Personel Hesabı'ndan açar/kapatır). Aynı hesabı birkaç kişi birden kullanabilir.
- **Personel ne görür:** Panel, takvim, seanslar, öğrenciler, öğretmenler. Finans, ödemeler, hakediş, raporlar, Excel aktarımı ve ayarlar kapalı.
- **Sunucuda zorlanır** (`staff-view.ts`): personele giden belgede ödemeler, öğretmen ödemeleri, hakedişler, devirler, aktarım/birleştirme geçmişi yoktur; seans/plan ücretleri, eğitim türü fiyatları, öğretmen ücret ve maaş alanları sıfırlanır/silinir. Personelin kaydından yalnızca öğrenciler, seanslar ve haftalık planlar alınır; öğrenci ve yapılmış ders silemez. Personelin eklediği/değiştirdiği derslerin ücreti ve hakedişi sunucuda, eğitim türünün fiyatı ve öğretmenin ücretinden hesaplanır.
- Şifreler **scrypt** ile saklanır; oturum `httpOnly` çerezde rastgele anahtardır, veritabanında SHA-256 özeti durur.
- Yanlış şifre o cihazı (ağ adresi) 5 denemede 5 dakika kilitler; tüm adreslerden toplam 30 yanlış deneme bütün girişleri 15 dakika kilitler. Şifre değişince o hesabın diğer cihazlardaki oturumu kapanır.
- Uç noktalar: `POST /api/setup`, `POST /api/auth/login|logout|password|profile`, `GET /api/auth/me`, `GET|POST|DELETE /api/staff` (yalnız yönetici).

## Veliler

Ayrı veli kaydı yoktur. Öğrencide isteğe bağlı `guardianName` / `guardianPhone` alanları vardır. Eski veri ve yedeklerdeki veli kayıtları açılışta bu alanlara aktarılır (`src/lib/data/migrate-guardians.ts`).

## 6. Kurum ve kimlik numaraları

- `TENANT_ID` bugün sabit (`"tenant-1"`). Birden fazla kurum olacaksa sunucu bu değeri oturumdan belirlemeli ve **her sorguda** filtrelemelidir.
- Kayıt kimlikleri `<önek>-<uuid>` biçiminde (`student-6f1c…`). İstemcide üretilir; sunucu aynen kabul edebilir. Eski kayıtlarda `student-1729…` gibi zaman damgalı kimlikler de vardır, ikisi de geçerli metindir.

## 7. Yedek dosyası

**Ayarlar → Yedekleme ve Excel → Yedek Al** bütün veriyi bir JSON dosyasına indirir; **Yedekten Geri Yükle** aynı dosyayı geri yükler (sunucuya kaydedilir). Biçim:

```json
{ "app": "ozel-egitim-yonetim", "schemaVersion": 1, "createdAt": "…", "data": { "students": [], "teachers": [], "…": [] } }
```

`data`, `PersistedState` ile birebir aynıdır (`BackupData`, `store.tsx`); giriş bilgileri yedekte yoktur. Yüklerken `normalizeInstitutionSettings` eski sürüm yedeklerindeki kaldırılmış alanları atar.

## 8. Testler

```bash
npm test        # hakediş, borç, finans paneli, Excel aktarımı, giriş kuralları, birleştirme
npm run typecheck
npm run build
```

Güvenlik başlıkları (CSP, çerçeveye gömme yasağı, HSTS) `next.config.ts` içindedir. Yerelde deneme yaparken canlı veritabanını kullanmamak için `DATABASE_URL`'i ayrı bir veritabanına yönlendirin.
