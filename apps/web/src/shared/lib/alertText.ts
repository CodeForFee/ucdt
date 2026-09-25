import { aqiCode } from "@/shared/lib/aqi";
import type { Alert } from "@/shared/types/alert";

type Translator = {
  (key: string, values?: Record<string, string | number>): string;
  has(key: string): boolean;
};

/**
 * rules.py generates `title`/`message` once, server-side, in Vietnamese only (no i18n there —
 * unlike Recommendations, this text used to be the only copy shipped). Migration 003 added
 * `unitId`/`unitName`/`value`; when present, this rebuilds the same content from the
 * `alertRules` i18n catalog in the active locale. An alert raised before that migration has
 * `unitName`/`value` null and falls back to the server's Vietnamese text — a graceful
 * degradation, not a bug.
 */
export function localizeAlert(alert: Alert, ar: Translator, aqiT: (code: string) => string): { title: string; message: string } {
  const key = `${alert.type}_${alert.severity}`;
  if (alert.unitName == null || alert.value == null || !ar.has(`${key}.title`)) {
    return { title: alert.title, message: alert.message };
  }
  const vars: Record<string, string | number> =
    alert.type === "flood"
      ? { name: alert.unitName, riskPct: Math.round(alert.value * 100) }
      : alert.type === "aqi"
        ? { name: alert.unitName, value: Math.round(alert.value), category: aqiT(aqiCode(alert.value)) }
        : { name: alert.unitName, value: alert.value.toFixed(1) };
  return { title: ar(`${key}.title`), message: ar(`${key}.message`, vars) };
}
