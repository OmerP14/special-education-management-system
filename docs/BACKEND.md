# Backend'e Geçiş Rehberi

Bu belge, sisteme sunucu tarafı (backend) ekleyecek geliştirici içindir. Uygulamanın verisi bugün kullanıcının tarayıcısında (localStorage) duruyor. Aşağıdakiler, bu veriyi bir sunucuya taşımak için gereken her şeyi anlatır.

## 1. Bugünkü yapı

| Katman | Dosya | Görevi |
|---|---|---|
| Veri kaynağı | `src/lib/data/source.ts` | Verinin **nerede** durduğu: `load`, `save`, `watch`. Sunucu bağlantısı yalnızca buraya yazılır. |
| Tarayıcı deposu | `src/lib/data/persistence.ts` | Bugünkü `DataSource` uygulaması (localStorage, sekmeler arası koruma, otomatik yedek). |
| Uygulama durumu | `src/lib/data/store.tsx` | Tüm kayıtlar ve onları değiştiren eylemler (`addStudent`, `updateSession`…). Sayfalar veriye yalnızca `useStore()` ile ulaşır. |
| İş kuralları | `src/lib/helpers/*.ts` | Borç, öğretmen hakedişi, devir, Excel aktarımı, çakışma kontrolü. Saf fonksiyonlar, testli. |
| Kimlik doğrulama | `src/lib/server/auth-core.ts`, `src/app/api/auth/*` | **Sunucuda (Neon Postgres).** Tarayıcı tarafı: `auth-service.ts` → `http-auth-service.ts`. |
| Kimlik numaraları | `src/lib/data/ids.ts` | Tüm kayıt kimlikleri (`createId`) ve kurum kimliği (`TENANT_ID`). |

Uygulama açılırken `DataProvider` veriyi `dataSource.load()` ile **asenkron** yükler (bu sırada "Yükleniyor…" ekranı görünür), her değişiklikten sonra durumun tamamını `dataSource.save()` ile kaydeder. Kaydetme başarısız olursa üst bantta uyarı çıkar.

## 2. Önerilen yol

### Aşama 1 — Tek belge olarak sunucuda saklama (en hızlı, en az risk)

Uygulamanın tüm iş kuralları tarayıcıda çalıştığı için sunucunun ilk aşamada hesap yapması gerekmez; sadece veriyi saklaması yeter.

1. Sunucuda iki uç nokta:
   - `GET /api/state` → kayıtlı durumu döner (yoksa `null`).
   - `PUT /api/state` → gövdedeki durumun tamamını kaydeder.
2. `src/lib/data/source.ts` içine bir `serverDataSource` yazın ve `dataSource` sabitini ona çevirin:

   ```ts
   export const serverDataSource: DataSource = {
     load: async () => (await fetch("/api/state")).json(),
     save: async (state) => (await fetch("/api/state", { method: "PUT", body: JSON.stringify(state) })).ok,
     watch: () => () => {},
   };
   export const dataSource: DataSource = serverDataSource;
   ```
3. **Eş zamanlı düzenleme:** Birden fazla kişi aynı anda çalışabilir. Her kayda bir sürüm numarası (veya `ETag`) ekleyin; `PUT` eski sürüme dayanıyorsa `409` dönün. `save` bu durumda `false` döndürsün, `watch` ise belirli aralıklarla sürümü kontrol edip yeni sürüm varsa sayfayı yenilesin. Bugünkü tarayıcı uygulaması (`watchOtherTabWrites`) aynı şeyi sekmeler arasında yapıyor.
4. Kaydedilen durumda giriş bilgisi yoktur; hesap ve oturumlar ayrı tablolardadır (bkz. Bölüm 5). `/api/state` yalnızca oturum çereziyle çalışmalı.

### Aşama 2 — Tablolara ayırma

Veri büyüdükçe (binlerce ders) her değişiklikte tüm durumu göndermek ağırlaşır. O zaman her kayıt türü ayrı tabloya ve ayrı uç noktalara ayrılır; `store.tsx` içindeki eylemler (`addSession`, `updatePayment`…) ilgili uç noktayı çağırır.

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

## 7. Mevcut verinin taşınması

Kurumun tarayıcısındaki veri **Ayarlar → Yedekleme ve Excel → Yedek Al** ile bir JSON dosyasına alınır. Bu dosyanın biçimi:

```json
{ "app": "ozel-egitim-yonetim", "schemaVersion": 1, "createdAt": "…", "data": { "students": [], "guardians": [], "…": [] } }
```

`data`, giriş bilgileri hariç `PersistedState` ile birebir aynıdır (`BackupData`, `store.tsx`). Sunucuya bir "yedekten içeri al" uç noktası eklemek, taşımanın en güvenli yoludur. Yükleme sırasında `normalizeInstitutionSettings` mantığı uygulanmalı: eski sürüm yedeklerindeki kaldırılmış alanlar (işlem geçmişi, roller, görünüm) atılır.

## 8. Testler

```bash
npm test        # 149 test: hakediş, borç, finans paneli, Excel aktarımı uçtan uca, yedek
npm run typecheck
npm run build
```

Sunucu tarafı yazıldıktan sonra aynı senaryolar (`src/lib/helpers/__tests__/money.test.ts`, `finance-panel.test.ts`, `import-pipeline.test.ts`) sunucunun döndürdüğü veriyle de geçmelidir.
