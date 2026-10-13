import { Lock } from "lucide-react";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGIN_ATTEMPTS, PASSWORD_RULES_TEXT } from "@/lib/auth/security-policy";
import { UPCOMING_SESSION_REMINDER_MINUTES } from "@/lib/helpers/notifications";

const SYSTEM_RULES = [
  { label: "Parola kuralı", value: PASSWORD_RULES_TEXT },
  {
    label: "Hatalı giriş kilidi",
    value: `${MAX_FAILED_LOGIN_ATTEMPTS} hatalı denemede hesap ${LOCKOUT_MINUTES} dakika kilitlenir.`,
  },
  {
    label: "Oturum",
    value: "Hareketsizlik nedeniyle otomatik çıkış yapılmaz. “Beni hatırla” seçilmezse oturum tarayıcı kapanınca biter.",
  },
  { label: "Sayı biçimi", value: "1.234.567,89 (Türkiye)" },
  { label: "İşlem geçmişi", value: "Tüm değişiklikler her zaman İşlem Geçmişi'ne kaydedilir." },
  {
    label: "Onaylar",
    value: "Silme ve kayıtlı bir ödemeyi değiştirme öncesi onay istenir; dışa aktarma ve yazdırma onaysız yapılır.",
  },
  {
    label: "Bildirimler",
    value: `Zilde: seans iptali, gelmeyen öğrenci, otomatik tamamlanan seans, alınan ödeme, öğretmene ödeme ve ${UPCOMING_SESSION_REMINDER_MINUTES} dk içinde başlayacak seans.`,
  },
];

export default function SecuritySettingsPage() {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-4">
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Sistem kuralları</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Bu kurallar sistem tarafından sabittir ve değiştirilemez.
      </p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        {SYSTEM_RULES.map((rule) => (
          <div key={rule.label} className="rounded-lg border border-border/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{rule.label}</dt>
            <dd className="text-sm text-foreground">{rule.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
