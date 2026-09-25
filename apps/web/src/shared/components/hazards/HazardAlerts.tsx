import { useTranslations } from "use-intl";
import { Bell, Droplets, Wind, Thermometer, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/shared/hooks/useAlerts";
import { useAlertStore } from "@/shared/stores/alertStore";
import { useMarkAlertsRead } from "@/shared/hooks/useMarkAlertsRead";
import { formatDateTime } from "@/shared/lib/formatters";
import { localizeAlert } from "@/shared/lib/alertText";
import type { Alert } from "@/shared/types/alert";

const TYPE_ICONS: Record<Alert["type"], React.ComponentType<{ className?: string }>> = {
  flood: Droplets,
  aqi: Wind,
  heat: Thermometer,
  storm: AlertTriangle,
};

const SEVERITY_BADGE: Record<Alert["severity"], string> = {
  warning: "bg-yellow-500/20 text-yellow-400",
  critical: "bg-red-500/20 text-red-400",
};

/**
 * Per-hazard active alerts, embedded on the /risks pages (spec's presentation-layer tile is
 * "Cảnh báo & khuyến nghị được xếp hạng" — one combined concept per hazard, not two separate
 * nav tabs — user request 2026-09-25). `storm` counts as `flood` here: the manuscript's three
 * hazards are flood/heat/air, and a storm alert is a flood-adjacent rainfall reading.
 */
export function HazardAlerts({ hazard }: { hazard: "flood" | "heat" | "aqi" }) {
  useAlerts();
  const { alerts } = useAlertStore();
  const { mutate: markRead } = useMarkAlertsRead();
  const ap = useTranslations("alertsPage");
  const ar = useTranslations("alertRules");
  const aqiT = useTranslations("aqi");

  const types: Alert["type"][] = hazard === "flood" ? ["flood", "storm"] : [hazard];
  const filtered = alerts.filter((a) => types.includes(a.type));

  const SEVERITY_LABELS: Record<Alert["severity"], string> = {
    warning: ap("warning"),
    critical: ap("urgent"),
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4 text-yellow-400" />
          {ap("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{ap("empty")}</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((alert) => {
              const Icon = TYPE_ICONS[alert.type] ?? Bell;
              const { title, message } = localizeAlert(alert, ar, aqiT);
              return (
                <li
                  key={alert.id}
                  className={`flex gap-3 p-2.5 rounded-lg border border-border/50 bg-muted/20 ${alert.isRead ? "opacity-60" : ""}`}
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-snug truncate">{title}</p>
                      <Badge className={`shrink-0 text-[10px] px-1.5 ${SEVERITY_BADGE[alert.severity]}`}>
                        {SEVERITY_LABELS[alert.severity]}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
                      {!alert.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-2 text-[10px] ml-auto"
                          onClick={() => markRead([alert.id])}
                        >
                          {ap("markRead")}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
