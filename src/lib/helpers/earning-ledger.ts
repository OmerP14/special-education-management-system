import type { Session, TeacherEarning } from "@/types";
import type { TeacherEarningsSettings } from "@/types/settings";
import { getActiveSettings } from "@/lib/settings/runtime";
import { getSessionEarningAmount, isEarningSession } from "@/lib/helpers/finance";

// Shared by the store (browser) and the server, which fills in earnings for
// sessions a staff account adds or changes (src/lib/server/staff-view.ts).

// Upserts the TeacherEarning ledger row for a single session, keyed by sessionId so
// re-saving the same completed session updates the existing row instead of duplicating it.
// Sessions that aren't earning-eligible (or whose computed earning is 0, e.g. salary-based
// teachers whose pay is tracked monthly, not per session) have their row removed instead.
export function upsertEarningForSession(
  prev: TeacherEarning[],
  session: Session,
  policy: TeacherEarningsSettings = getActiveSettings().teacherEarnings
): TeacherEarning[] {
  const withoutThisSession = prev.filter((e) => e.sessionId !== session.id);
  // Status share (telafi/iptal/gelmedi), approval and rounding all come from
  // Ayarlar → Öğretmen ve Hakediş — see getSessionEarningFactor.
  const amount = getSessionEarningAmount(session, policy);

  if (!isEarningSession(session, policy) || amount <= 0) {
    return withoutThisSession;
  }

  // amount > 0 here (guarded above), so this can only ever be a real calculated
  // figure — an "unknown" session's teacherEarning is always 0 and never reaches
  // this point (see resolveTeacherEarningStatus in finance.ts).
  const existing = prev.find((e) => e.sessionId === session.id);
  const earning: TeacherEarning = existing
    ? { ...existing, teacherId: session.teacherId, amount, calculationStatus: "calculated" }
    : {
        id: `earning-${session.id}`,
        tenantId: session.tenantId,
        teacherId: session.teacherId,
        sessionId: session.id,
        amount,
        status: "pending",
        calculationStatus: "calculated",
        createdAt: new Date().toISOString(),
      };

  return [...withoutThisSession, earning];
}
