# Sunucu (Backend) Rehberi

Bu belge sistemi geliştirecek kişi içindir. Site Vercel'de çalışır; giriş bilgileri ve kurumun bütün kayıtları **Neon Postgres** veritabanındadır. Bağlantı adresi `DATABASE_URL` ortam değişkenindedir (Vercel ↔ Neon entegrasyonu ayarlar; geliştirme için `npx vercel env pull .env.local`). Tablolar ilk istekte kendiliğinden oluşur.

## 1. Yapı

| Katman | Dosya | Görevi |
|---|---|---|
| Veri kaynağı | `src/lib/data/source.ts` → `server-source.ts` | Verinin sunucuyla eşitlenmesi: `load`, `save`, `flush`, `watch`. |
| Birleştirme | `src/lib/data/merge.ts` | İki cihaz aynı anda kaydedince değişiklikleri kayıt kayıt (`id` ile) birleştirir. Testli. |
| Uygulama durumu | `src/lib/data/store.tsx` | Tüm kayıtlar ve onları değiştiren eylemler. Sayfalar veriye yalnızca `useStore()` ile ulaşır. Giriş yapılmadan yüklenmez. |
| İş kuralları | `src/lib/helpers/*.ts` | Borç, öğretmen hakedişi, devir, Excel aktarımı, çakışma kontrolü. Tarayıcıda çalışır, testli. |
| Kimlik doğrulama | `src/lib/server/auth-core.ts`, `src/app/api/auth/*`, `src/app/api/setup` | Hesap, şifre, oturum (bkz. Bölüm 5). |
| Veri uç noktaları | `src/app/api/state`, `src/lib/server/state-repo.ts` | Kurumun verisi (aşağıda). |
| Yedekler | `src/lib/data/persistence.ts`, `src/lib/backup/backup-folder.ts` | Yedek dosyası, tarayıcıda günlük otomatik yedek, klasöre yedek. |

## 2. Veri nasıl saklanıyor

**Bugün (Aşama 1):** Kurumun bütün verisi `app_state` tablosunda tek satırda, `jsonb` olarak durur; yanında bir `version` sayısı vardır.

- `GET /api/state` → `{ data, version }` (gzip). `GET /api/state/version` → yalnızca sürüm (cihazlar 8 saniyede bir sorar).
- `PUT /api/state` gövdesi `{ data, baseVersion }` (gzip). Sürüm tutuyorsa kaydedilir ve sürüm bir artar. Tutmuyorsa `409` ile güncel veri döner; tarayıcı kendi değişikliklerini onun üstüne birleştirip (`merge.ts`) yeniden gönderir.
- Gövdeler gzip'li gider gelir; Vercel'in 4,5 MB istek sınırına bu sayede uzun süre takılmaz.
- Her istek oturum çerezi ister; veri değiştiren istekler yalnızca sitenin kendi sayfalarından kabul edilir (`isSameOrigin`).
- Değişiklikler 0,4 sn bekletilip toplu gönderilir. Kaydedilemezse üstte uyarı çıkar, 5 sn'de bir yeniden denenir; gönderilmemiş değişiklik varken sekme kapatılırsa tarayıcı uyarır.

**Bilinen sınırlar:** İki cihaz aynı kaydı aynı anda düzenlerse sonra kaydedenin hali kalır. Makbuz ve öğrenci numaraları tarayıcıda verilir; iki cihaz aynı saniyede yeni kayıt açarsa aynı numara çıkabilir.

**Aşama 2 (ileride):** Veri çok büyüyünce (on binlerce ders) her kayıt türü ayrı tabloya ve ayrı uç noktalara ayrılır; numaralar veritabanı dizisinden verilir.

## 3. Veri modeli

Tüm türler `src/types/index.ts` ve `src/types/settings.ts` içindedir. Her kayıtta `id` (metin, `createId` ile üretilir), `tenantId`, `createdAt` ve çoğunda `updatedAt` bulunur. Tarihler ISO 8601 metindir; yalnızca gün olan alanlar `YYYY-MM-DD`, ders saatleri yerel saattir (`2026-10-06T10:00:00`, saat dilimi eki **yok**; kurum Türkiye saatinde çalışır).

| Tablo | Önemli alanlar | İlişkiler |
|---|---|---|
| `students` | `fullName`, `birthDate`, `status` (active / inactive / on_hold), `studentNumber`, `kvkkConsent` | `guardianIds[]` → guardians, `educationTypeIds[]` → education_types |
| `guardians` | `fullName`, `phone`, `relationship` | `studentIds[]` → students (**iki yönlü**, bkz. Bölüm 4) |
| `teachers` | `fullName`, `status` (active / inactive / archived), `earningType`, `monthlySalary`, `includedSessionQuota`, `extraSessionEarning`, `earningPercentage`, `leftAt`, `openingBalance` | `mergedIntoTeacherId` → teachers |
| `education_types` | `name`, `defaultStudentPrice`, `color`, `status` | — |
| `teacher_education_type_assignments` | `earningAmount` (ders başı öğretmen ücreti; `null` = tanımlanmamış), `status` | teacher, education type |
| `sessions` (dersler) | `date`, `durationMinutes`, `sessionCount` (blok ders = 2), `studentPrice`, `teacherEarning`, `status`, `billingMode`, `earningFactor`, `teacherEarningStatus` | student, teacher, education type, `weeklyPlanId`, `importBatchId` |
| `payments` (veli ödemeleri) | `amount`, `method`, `date`, `receiptNumber`, `historical` | student |
| `teacher_payments` | `amount`, `paymentType` (salary / advance / partial / bonus / deduction / other), `method`, `date`, `historical` | teacher |
| `opening_balances` (öğrenci devri) | `amount` (her zaman pozitif), `balanceType` (debt / credit), `date` | student, guardian |
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
- **Veli ↔ öğrenci bağı iki yönlüdür:** `student.guardianIds` ile `guardian.studentIds` birlikte güncellenir. → `store.addStudent / deleteStudents`
- **Makbuz numarası** `MKB-<yıl>-<sıra>` biçiminde, 1000'den başlar; geçmiş kayıt ödemesine numara verilmez. Sunucuda bu sıra **tek yerden** (veritabanı dizisi) verilmeli, yoksa iki cihaz aynı numarayı üretebilir.
- **Öğrenci numarası** (`OGR-0001`…) da aynı şekilde tek yerden verilmeli.
- **Çakışma:** Aynı öğretmene veya öğrenciye aynı saatte iki ders verilmez; aradaki mola ayarlıdır. → `session-conflict.ts`

## 5. Kimlik doğrulama — sunucuda (tamamlandı)

- Hesap, şifre ve oturumlar Neon Postgres'te: `account` (tek satır) ve `auth_sessions` tabloları. Tablolar ilk istekte kendiliğinden oluşur (`src/lib/server/db.ts`). Hazır hesap yoktur: boş veritabanında site `/setup` kurulum ekranını açar, hesabı ilk kurulum oluşturur (`POST /api/setup`, hesap varsa reddedilir).
- Şifre sunucuda **scrypt** ile saklanır (`src/lib/server/password-hash.ts`).
- Oturum `httpOnly` çerezde rastgele bir anahtardır; veritabanında yalnızca SHA-256 özeti durur. "Beni hatırla" kapalıysa çerez tarayıcı kapanınca silinir.
- Kurallar `src/lib/server/auth-core.ts` içinde ve testli: 3 hatalı denemede 5 dakika kilit, şifre değişince diğer cihazların oturumu kapanır, kullanıcı adı büyük/küçük harf ve ı/i farkı gözetmez.
- Uç noktalar: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password`, `POST /api/auth/profile`.

## 6. Kurum ve kimlik numaraları

- `TENANT_ID` bugün sabit (`"tenant-1"`). Birden fazla kurum olacaksa sunucu bu değeri oturumdan belirlemeli ve **her sorguda** filtrelemelidir.
- Kayıt kimlikleri `<önek>-<uuid>` biçiminde (`student-6f1c…`). İstemcide üretilir; sunucu aynen kabul edebilir. Eski kayıtlarda `student-1729…` gibi zaman damgalı kimlikler de vardır, ikisi de geçerli metindir.

## 7. Yedek dosyası

**Ayarlar → Yedekleme ve Excel → Yedek Al** bütün veriyi bir JSON dosyasına indirir; **Yedekten Geri Yükle** aynı dosyayı geri yükler (sunucuya kaydedilir). Biçim:

```json
{ "app": "ozel-egitim-yonetim", "schemaVersion": 1, "createdAt": "…", "data": { "students": [], "guardians": [], "…": [] } }
```

`data`, `PersistedState` ile birebir aynıdır (`BackupData`, `store.tsx`); giriş bilgileri yedekte yoktur. Yüklerken `normalizeInstitutionSettings` eski sürüm yedeklerindeki kaldırılmış alanları atar.

## 8. Testler

```bash
npm test        # hakediş, borç, finans paneli, Excel aktarımı, giriş kuralları, birleştirme
npm run typecheck
npm run build
```

Güvenlik başlıkları (CSP, çerçeveye gömme yasağı, HSTS) `next.config.ts` içindedir. Yerelde deneme yaparken canlı veritabanını kullanmamak için `DATABASE_URL`'i ayrı bir veritabanına yönlendirin.
