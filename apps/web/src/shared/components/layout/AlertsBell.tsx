import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslations } from "use-intl";
import { Bell, CheckCheck, Droplets, Wind, Thermometer, CloudRain, ChevronRight } from "lucide-react";
import { useAlerts } from "@/shared/hooks/useAlerts";
import { useMarkAlertsRead } from "@/shared/hooks/useMarkAlertsRead";
import { useUnitNames } from "@/shared/hooks/useUnits";
import { useAlertStore } from "@/shared/stores/alertStore";
import { formatDateTime } from "@/shared/lib/formatters";
import type { Alert } from "@/shared/types/alert";

const TYPE_ICONS: Record<Alert["type"], React.ComponentType<{ className?: string }>> = {
  flood: Droplets,
  aqi: Wind,
  heat: Thermometer,
  storm: CloudRain,
};

/** §F alert id `<hazard>:<unitId>:<band>:<YYYY-MM-DDTHH>` → unitId. The Alert payload carries
 *  no unitId/unitName field (SimAlert does), so the toponym is joined via /api/units. */
const alertUnitId = (id: string) => id.split(":")[1];

/**
 * Header bell (§F, §J): unread badge + a dropdown of the per-unit alerts (title, toponym,
 * severity, time) with mark-as-read through POST /api/alerts/read. The list lives in the
 * alert store, fed by useAlerts, whose query `alert.created` SSE events invalidate
 * (useLiveEvents) — so the badge refreshes live. Toponym only; `commune` is never rendered.
 */
export function AlertsBell() {
  useAlerts();
  const { alerts, unreadCount } = useAlertStore();
  const { mutate: markRead } = useMarkAlertsRead();
  const { data: unitNames } = useUnitNames();
  const t = useTranslations("alertsBell");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("open")}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="relative h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="alerts-badge"
            className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="absolute right-0 top-10 z-50 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
            <div>
              <p className="text-sm font-semibold">{t("title")}</p>
              <p className="text-[11px] text-muted-foreground">{t("unread", { count: unreadCount })}</p>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markRead(alerts.filter((a) => !a.isRead).map((a) => a.id))}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("readAll")}
              </button>
            )}
          </div>

          {alerts.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Bell className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">{t("empty")}</p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto divide-y divide-border/60">
              {alerts.map((a) => {
                const Icon = TYPE_ICONS[a.type] ?? Bell;
                const toponym = unitNames?.get(alertUnitId(a.id));
                return (
                  <li key={a.id} className={`flex gap-2 px-3 py-2 ${a.isRead ? "opacity-60" : ""}`}>
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`shrink-0 rounded px-1 text-[10px] font-semibold ${a.severity === "critical" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}
                        >
                          {t(`severity.${a.severity}`)}
                        </span>
                        {toponym && <span className="text-xs font-medium truncate">{toponym}</span>}
                      </div>
                      <p className="text-xs leading-snug mt-0.5">{a.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(a.createdAt)}</p>
                    </div>
                    {!a.isRead && (
                      <button
                        type="button"
                        onClick={() => markRead([a.id])}
                        className="self-start shrink-0 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {t("markRead")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-0.5 border-t border-border px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {t("all")} <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
