import { Link } from "react-router-dom";
import { useTranslations } from "use-intl";
import { Bell, ChevronRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAlerts } from "@/shared/hooks/useAlerts";
import { useAlertStore } from "@/shared/stores/alertStore";

export function AlertsSummaryCard() {
  useAlerts();
  const { alerts } = useAlertStore();
  const d = useTranslations("dashboard");
  const unread = alerts.filter((a) => !a.isRead);
  const top = alerts.slice(0, 4);

  const severityStyle = (s: string) =>
    s === "critical"
      ? "border-l-red-500 bg-red-500/5"
      : s === "warning"
        ? "border-l-yellow-500 bg-yellow-500/5"
        : "border-l-blue-500 bg-blue-500/5";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between shrink-0">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bell className="h-4 w-4 text-yellow-400" />
          {d("alertsTitle")}
          {unread.length > 0 && (
            <span className="h-4 min-w-4 px-1 rounded-full bg-destructive text-[9px] font-bold text-white flex items-center justify-center">
              {unread.length}
            </span>
          )}
        </CardTitle>
        <Link
          to="/alerts"
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
        >
          {d("allAlerts")} <ChevronRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto max-h-80">
        {top.length === 0 ? (
          <div className="text-center py-6">
            <AlertTriangle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">{d("noAlerts")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {top.map((a) => (
              <div
                key={a.id}
                className={`border-l-4 rounded-r-lg px-3 py-2 ${severityStyle(a.severity)} ${a.isRead ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium leading-snug">{a.title}</p>
                  {!a.isRead && <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-primary mt-1" />}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{a.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
