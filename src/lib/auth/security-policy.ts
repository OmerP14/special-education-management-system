// ─── Fixed security policy ───────────────────────────────────────────────────
//
// System rules, not institution settings: no screen changes them. Every
// password form, the login lockout and the sign-in flow read these constants
// directly. Sessions have no idle timeout — a signed-in user is never signed
// out for inactivity; without "Beni hatırla" the session ends when the
// browser closes (see AuthProvider).

export const PASSWORD_MIN_LENGTH = 6;

/** Wrong passwords in a row before the account locks. */
export const MAX_FAILED_LOGIN_ATTEMPTS = 3;
export const LOCKOUT_MINUTES = 5;

/** Plain-language summary shown under every new-password field. */
export const PASSWORD_RULES_TEXT =
  `En az ${PASSWORD_MIN_LENGTH} karakter; en az bir büyük harf, bir rakam ve bir özel karakter (. ! @ # gibi) içermelidir.`;
