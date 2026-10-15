/**
 * Resumen semanal del taller: el correo que recoge lo que se trabajó durante la
 * semana, lo que quedó sin constancia y lo que se archivó.
 */

import { weeklyDigest } from "./weeklyReport/digest";
import { renderWeeklyReport } from "./weeklyReport/renderer";
import {
  weeklyReportKey,
  type WeeklyReport,
  type WeeklyReportSource,
} from "./weeklyReport/types";

export { weeklyDigest } from "./weeklyReport/digest";
export { renderWeeklyReport } from "./weeklyReport/renderer";
export {
  countsInWeeklyReport,
  DEFAULT_WEEKLY_REPORT_ROLES,
  DEFAULT_WEEKLY_REPORT_WEEKDAY,
  MAX_DETAIL_LINES,
  MAX_WEEKDAY,
  MAX_WORKERS,
  MIN_WEEKDAY,
  utcWeekday,
  WEEK_DAYS,
  WEEK_MS,
  WEEKDAY_OPTIONS,
  weekdayLabel,
  weeklyDeliveryBlocker,
  weeklyRecipients,
  weeklyReportKey,
  weeklyReportWeekday,
  weeklyReportWindow,
  weeklyScheduleDecision,
  WEEKLY_REPORT_HISTORY_LIMIT,
  type WeeklyArchivedLine,
  type WeeklyClosedLine,
  type WeeklyDigest,
  type WeeklyEmail,
  type WeeklyIncident,
  type WeeklyRecipientSource,
  type WeeklyReport,
  type WeeklyReportSource,
  type WeeklyRequest,
  type WeeklyTraceLine,
  type WeeklyWindow,
} from "./weeklyReport/types";

/**
 * Compone el resumen de la semana que termina en `now`: el trabajo hecho, lo que
 * sigue sin constancia, lo archivado y el correo, todo en una pieza.
 */
export function composeWeeklyReport(
  source: WeeklyReportSource,
  options: { now?: number; appUrl?: string | null } = {},
): WeeklyReport {
  const now = options.now ?? Date.now();
  const digest = weeklyDigest({
    incidents: source.incidents,
    requests: source.requests,
    now,
    marginDays: source.marginDays,
  });
  const email = renderWeeklyReport(digest, { appUrl: options.appUrl });
  return {
    key: weeklyReportKey(now),
    from: digest.window.from,
    to: digest.window.to,
    windowLabel: digest.window.label,
    marginDays: digest.marginDays,
    subject: email.subject,
    text: email.text,
    html: email.html,
    recipients: [...source.recipients],
    summary: {
      touched: digest.worked.incidentsTouched,
      withoutTrace: digest.withoutTrace.length,
      archived: digest.archived.total,
    },
  };
}
