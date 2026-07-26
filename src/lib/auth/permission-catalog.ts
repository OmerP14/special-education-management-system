import type { PermissionMeta } from "@/types/auth";
import { SETTINGS_SECTIONS } from "@/lib/settings/sections";

// ─── Canonical permission catalog ───────────────────────────────────────────
//
// One entry per key, grouped by module — same shape SETTINGS_SECTIONS already
// uses. The 13 settings.* keys below are the exact strings already declared
// on SETTINGS_SECTIONS[*].permissionKey (built in a prior session) — copied
// verbatim rather than reinvented so both registries always agree.
//
// Phase 1 only *enforces* a subset of this catalog (route guards, nav
// filtering, the two migrated page guards) — the rest is seeded now so a
// later phase's resource-scoping/finer-grained UI never has to re-seed
// role->permission defaults from scratch. See getRoleByKey in roles.ts for
// which keys each of the 7 system roles actually holds today.

function settingsPermissionKey(key: (typeof SETTINGS_SECTIONS)[number]["key"]): string {
  const meta = SETTINGS_SECTIONS.find((s) => s.key === key);
  if (!meta) throw new Error(`Unknown settings section: ${key}`);
  return meta.permissionKey;
}

export const PERMISSION_CATALOG: PermissionMeta[] = [
  // ─── Dashboard ─────────────────────────────────────────────────────────────
  { key: "dashboard.view", module: "dashboard", label: "Paneli Görüntüle", description: "Genel bakış panelini görüntüleme." },
  { key: "dashboard.operational.view", module: "dashboard", label: "Operasyonel Panel", description: "Seans/öğrenci/öğretmen odaklı operasyonel görünüm." },
  { key: "dashboard.finance.view", module: "dashboard", label: "Finansal Panel Özeti", description: "Panelde ciro/tahsilat gibi finansal özet kartları.", sensitive: true },

  // ─── Students ──────────────────────────────────────────────────────────────
  { key: "students.view", module: "students", label: "Öğrencileri Görüntüle", description: "Öğrenci listesi ve detayına erişim." },
  { key: "students.create", module: "students", label: "Öğrenci Ekle", description: "Yeni öğrenci kaydı oluşturma." },
  { key: "students.edit", module: "students", label: "Öğrenci Düzenle", description: "Mevcut öğrenci kaydını güncelleme." },
  { key: "students.archive", module: "students", label: "Öğrenci Arşivle", description: "Öğrenciyi pasif/arşiv durumuna alma." },
  { key: "students.view_finance", module: "students", label: "Öğrenci Finans Bilgisi", description: "Öğrenci borç/ödeme bilgilerini görüntüleme.", sensitive: true },
  { key: "students.view_private_notes", module: "students", label: "Özel Notları Görüntüle", description: "Sağlık/özel not gibi hassas alanları görüntüleme.", sensitive: true },

  // ─── Guardians ─────────────────────────────────────────────────────────────
  { key: "guardians.view", module: "guardians", label: "Velileri Görüntüle", description: "Veli listesi ve detayına erişim." },
  { key: "guardians.create", module: "guardians", label: "Veli Ekle", description: "Yeni veli kaydı oluşturma." },
  { key: "guardians.edit", module: "guardians", label: "Veli Düzenle", description: "Mevcut veli kaydını güncelleme." },
  { key: "guardians.view_finance", module: "guardians", label: "Veli Finans Bilgisi", description: "Veliye bağlı borç/ödeme bilgilerini görüntüleme.", sensitive: true },

  // ─── Teachers ──────────────────────────────────────────────────────────────
  { key: "teachers.view", module: "teachers", label: "Öğretmenleri Görüntüle", description: "Öğretmen listesi ve detayına erişim." },
  { key: "teachers.create", module: "teachers", label: "Öğretmen Ekle", description: "Yeni öğretmen kaydı oluşturma." },
  { key: "teachers.edit", module: "teachers", label: "Öğretmen Düzenle", description: "Mevcut öğretmen kaydını güncelleme." },
  { key: "teachers.archive", module: "teachers", label: "Öğretmen Arşivle", description: "Öğretmeni pasif/arşiv durumuna alma." },
  { key: "teachers.view_earnings", module: "teachers", label: "Hakedişleri Görüntüle", description: "Öğretmen hakediş tutarlarını görüntüleme.", sensitive: true },
  { key: "teachers.manage_earnings", module: "teachers", label: "Hakediş Yönetimi", description: "Öğretmen hakediş/ödeme kayıtlarını yönetme.", sensitive: true },
  { key: "teachers.manage_assignments", module: "teachers", label: "Eğitim Türü Ataması", description: "Öğretmen–eğitim türü atamalarını yönetme." },

  // ─── Sessions ──────────────────────────────────────────────────────────────
  { key: "sessions.view", module: "sessions", label: "Seansları Görüntüle", description: "Seans listesine erişim." },
  { key: "sessions.create", module: "sessions", label: "Seans Oluştur", description: "Yeni seans planlama." },
  { key: "sessions.edit", module: "sessions", label: "Seans Düzenle", description: "Mevcut seansı güncelleme." },
  { key: "sessions.cancel", module: "sessions", label: "Seans İptal Et", description: "Seansı iptal etme." },
  { key: "sessions.complete", module: "sessions", label: "Seans Tamamla", description: "Seansı tamamlandı olarak işaretleme." },
  { key: "sessions.delete", module: "sessions", label: "Seans Sil", description: "Seans kaydını silme." },
  { key: "sessions.view_all_teachers", module: "sessions", label: "Tüm Öğretmenlerin Seansları", description: "Kurum genelindeki tüm seansları görüntüleme." },
  { key: "sessions.view_own", module: "sessions", label: "Kendi Seansları", description: "Yalnızca kendi seanslarını görüntüleme." },

  // ─── Calendar ──────────────────────────────────────────────────────────────
  { key: "calendar.view", module: "calendar", label: "Takvimi Görüntüle", description: "Takvim ekranına erişim." },
  { key: "calendar.view_all", module: "calendar", label: "Tüm Takvim", description: "Kurum genelindeki takvimi görüntüleme." },
  { key: "calendar.view_own", module: "calendar", label: "Kendi Takvimi", description: "Yalnızca kendi takvimini görüntüleme." },
  { key: "calendar.manage", module: "calendar", label: "Takvimi Yönet", description: "Takvimden seans oluşturma/düzenleme." },

  // ─── Finance ───────────────────────────────────────────────────────────────
  { key: "finance.view", module: "finance", label: "Finans Modülü", description: "Finans modülüne genel erişim.", sensitive: true },
  { key: "finance.dashboard.view", module: "finance", label: "Finansal Panel", description: "Finansal Panel ekranını görüntüleme.", sensitive: true },
  { key: "finance.student_payments.view", module: "finance", label: "Öğrenci Ödemeleri", description: "Öğrenci ödeme kayıtlarını görüntüleme.", sensitive: true },
  { key: "finance.student_payments.create", module: "finance", label: "Ödeme Kaydet", description: "Yeni öğrenci ödemesi kaydetme.", sensitive: true },
  { key: "finance.student_payments.edit", module: "finance", label: "Ödeme Düzenle", description: "Mevcut ödeme kaydını güncelleme.", sensitive: true },
  { key: "finance.teacher_earnings.view", module: "finance", label: "Öğretmen Hakedişleri", description: "Öğretmen hakediş ekranını görüntüleme.", sensitive: true },
  { key: "finance.teacher_payments.create", module: "finance", label: "Öğretmen Ödemesi Kaydet", description: "Öğretmene ödeme kaydetme.", sensitive: true },
  { key: "finance.cash.view", module: "finance", label: "Günlük Kasa", description: "Kasa ekranını görüntüleme.", sensitive: true },
  { key: "finance.installments.manage", module: "finance", label: "Taksit Yönetimi", description: "Taksit planlarını yönetme.", sensitive: true },
  { key: "finance.export", module: "finance", label: "Finans Verisi Dışa Aktar", description: "Finansal verileri dışa aktarma.", sensitive: true },

  // ─── Reports ───────────────────────────────────────────────────────────────
  { key: "reports.view", module: "reports", label: "Raporları Görüntüle", description: "Raporlar ekranına erişim." },
  { key: "reports.finance.view", module: "reports", label: "Finans Raporları", description: "Finansal raporları görüntüleme.", sensitive: true },
  { key: "reports.education.view", module: "reports", label: "Eğitim Raporları", description: "Eğitim/seans raporlarını görüntüleme." },
  { key: "reports.students.view", module: "reports", label: "Öğrenci Raporları", description: "Öğrenci bazlı raporları görüntüleme." },
  { key: "reports.teachers.view", module: "reports", label: "Öğretmen Raporları", description: "Öğretmen bazlı raporları görüntüleme." },
  { key: "reports.export", module: "reports", label: "Rapor Dışa Aktar", description: "Raporları CSV/PDF olarak dışa aktarma." },

  // ─── Import / Data ─────────────────────────────────────────────────────────
  { key: "import.view", module: "import", label: "İçe Aktarımı Görüntüle", description: "Excel içe aktarım ekranına erişim." },
  { key: "import.execute", module: "import", label: "İçe Aktarım Yap", description: "Excel dosyasından veri içe aktarma." },
  { key: "import.repair", module: "import", label: "İçe Aktarım Onarımı", description: "Hatalı içe aktarım satırlarını düzeltme." },
  { key: "data.export", module: "data", label: "Veri Dışa Aktar", description: "Kurum verisini dışa aktarma.", sensitive: true },
  { key: "data.backup", module: "data", label: "Yedek Al", description: "Manuel yedek alma.", sensitive: true },
  { key: "data.restore", module: "data", label: "Yedeği Geri Yükle", description: "Bir yedekten geri yükleme.", sensitive: true },
  { key: "data.reset", module: "data", label: "Verileri Sıfırla", description: "Tüm verileri demo verilerine sıfırlama.", sensitive: true },
  { key: "data.audit", module: "data", label: "Veri Denetimi", description: "Veri tutarlılığı denetimi çalıştırma." },

  // ─── Settings ──────────────────────────────────────────────────────────────
  { key: "settings.view", module: "settings", label: "Ayarları Görüntüle", description: "Ayarlar bölümüne genel erişim." },
  { key: settingsPermissionKey("institution"), module: "settings", label: "Kurum Bilgileri", description: "Kurum profili ayarlarını yönetme." },
  { key: settingsPermissionKey("educationTypes"), module: "settings", label: "Eğitim Türleri", description: "Eğitim türü ayarlarını yönetme." },
  { key: settingsPermissionKey("sessions"), module: "settings", label: "Seans Ayarları", description: "Seans davranış ayarlarını yönetme." },
  { key: settingsPermissionKey("calendar"), module: "settings", label: "Takvim Ayarları", description: "Takvim/çalışma saatleri ayarlarını yönetme." },
  { key: settingsPermissionKey("finance"), module: "settings", label: "Finans Ayarları", description: "Finans ayarlarını yönetme.", sensitive: true },
  { key: settingsPermissionKey("teacherEarnings"), module: "settings", label: "Hakediş Ayarları", description: "Öğretmen hakediş politikalarını yönetme.", sensitive: true },
  { key: settingsPermissionKey("students"), module: "settings", label: "Öğrenci Ayarları", description: "Öğrenci/veli ayarlarını yönetme." },
  { key: settingsPermissionKey("notifications"), module: "settings", label: "Bildirim Ayarları", description: "Bildirim ayarlarını yönetme." },
  { key: settingsPermissionKey("users"), module: "settings", label: "Kullanıcı Yönetimi", description: "Kullanıcıları ve rollerini yönetme.", sensitive: true },
  { key: "settings.roles.manage", module: "settings", label: "Rol Yönetimi", description: "Rol ve izin matrisini yönetme (Faz 2).", sensitive: true },
  { key: settingsPermissionKey("data"), module: "settings", label: "Veri Yönetimi Ayarları", description: "İçe/dışa aktarım ve yedekleme ayarlarını yönetme.", sensitive: true },
  { key: "settings.documents.manage", module: "settings", label: "Belge Ayarları", description: "Belge/export şablon ayarlarını yönetme." },
  { key: settingsPermissionKey("appearance"), module: "settings", label: "Görünüm Ayarları", description: "Marka ve görünüm ayarlarını yönetme." },
  { key: settingsPermissionKey("security"), module: "settings", label: "Güvenlik Ayarları", description: "Oturum/parola/güvenlik ayarlarını yönetme.", sensitive: true },
  { key: settingsPermissionKey("audit"), module: "settings", label: "İşlem Geçmişi", description: "Denetim kaydını görüntüleme.", sensitive: true },

  // ─── Notifications ─────────────────────────────────────────────────────────
  { key: "notifications.view", module: "notifications", label: "Bildirimleri Görüntüle", description: "Uygulama içi bildirimleri görüntüleme." },
  { key: "notifications.manage", module: "notifications", label: "Bildirimleri Yönet", description: "Bildirim ayarlarını yönetme." },

  // ─── Profile ───────────────────────────────────────────────────────────────
  { key: "profile.view", module: "profile", label: "Profili Görüntüle", description: "Kendi profil bilgilerini görüntüleme." },
  { key: "profile.edit", module: "profile", label: "Profili Düzenle", description: "Kendi profil bilgilerini düzenleme." },
  { key: "profile.change_password", module: "profile", label: "Şifre Değiştir", description: "Kendi şifresini değiştirme." },
];

export const PERMISSION_KEYS = PERMISSION_CATALOG.map((p) => p.key);

export function getPermissionMeta(key: string): PermissionMeta | undefined {
  return PERMISSION_CATALOG.find((p) => p.key === key);
}
