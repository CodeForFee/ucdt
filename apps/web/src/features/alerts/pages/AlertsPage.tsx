import { useState } from "react";
import { useTranslations } from "use-intl";
import { Bell, CheckCheck, Droplets, Wind, Thermometer, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAlerts } from "@/shared/hooks/useAlerts";
import { useAlertStore } from "@/shared/stores/alertStore";
import { useMarkAlertsRead } from "@/shared/hooks/useMarkAlertsRead";
import { LoadingSkeleton } from "@/shared/components/common/LoadingSkeleton";
import { ErrorState } from "@/shared/components/common/ErrorState";
import { formatDateTime } from "@/shared/lib/formatters";
import type { Alert } from "@/shared/types/alert";

const TYPE_ICONS: Record<Alert["type"], React.ComponentType<{ className?: string }>> = {
  flood: Droplets,
  aqi: Wind,
  heat: Thermometer,
  storm: AlertTriangle,
  system: Bell,
};

const SEVERITY_STYLES: Record<Alert["severity"], string> = {
  info: "border-l-blue-500 bg-blue-500/5",
  warning: "border-l-yellow-500 bg-yellow-500/5",
  critical: "border-l-red-500 bg-red-500/5",
};

const SEVERITY_BADGE: Record<Alert["severity"], string> = {
  info: "bg-blue-500/20 text-blue-400",
  warning: "bg-yellow-500/20 text-yellow-400",
  critical: "bg-red-500/20 text-red-400",
};

function AlertCard({ alert }: { alert: Alert }) {
  const { mutate: markRead } = useMarkAlertsRead();
  const Icon = TYPE_ICONS[alert.type] ?? Bell;
  const ap = useTranslations("alertsPage");

  const SEVERITY_LABELS: Record<Alert["severity"], string> = {
    info: ap("info"),
    warning: ap("warning"),
    critical: ap("urgent"),
  };

  return (
    <Card
      className={`border-l-4 transition-opacity ${SEVERITY_STYLES[alert.severity]} ${alert.isRead ? "opacity-60" : ""}`}
    >
      <CardContent className="flex gap-3 py-4">
        <div className="shrink-0 mt-0.5">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-medium ${!alert.isRead ? "text-foreground" : "text-muted-foreground"}`}>
              {alert.title}
            </p>
            <Badge className={`shrink-0 text-[10px] px-1.5 ${SEVERITY_BADGE[alert.severity]}`}>
              {SEVERITY_LABELS[alert.severity]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-muted-foreground">{formatDateTime(alert.createdAt)}</span>
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
        {!alert.isRead && <div className="shrink-0 h-2 w-2 rounded-full bg-primary mt-1" />}
      </CardContent>
    </Card>
  );
}

const TABS = ["all", "unread", "critical", "flood", "aqi"] as const;

export default function AlertsPage() {
  const { isLoading, isError, refetch } = useAlerts();
  const { alerts, unreadCount } = useAlertStore();
  const { mutate: markRead } = useMarkAlertsRead();
  const [activeTab, setActiveTab] = useState<string>("all");
  const ap = useTranslations("alertsPage");

  const filtered = alerts.filter((a) => {
    if (activeTab === "unread") return !a.isRead;
    if (activeTab === "flood") return a.type === "flood";
    if (activeTab === "aqi") return a.type === "aqi";
    if (activeTab === "critical") return a.severity === "critical";
    return true;
  });

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{ap("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} ${ap("filterUnread").toLowerCase()}` : ap("noAlerts")}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => markRead(alerts.filter((a) => !a.isRead).map((a) => a.id))}
          >
            <CheckCheck className="h-4 w-4 mr-1.5" />
            {ap("readAll")}
          </Button>
        )}
      </div>

      {isLoading && <LoadingSkeleton count={4} variant="list" />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
          <TabsList className="grid grid-cols-5 w-full max-w-lg">
            <TabsTrigger value="all">{ap("filterAll")}</TabsTrigger>
            <TabsTrigger value="unread">
              {ap("filterUnread")}
              {unreadCount > 0 && (
                <span className="ml-1 h-4 w-4 rounded-full bg-destructive text-[9px] text-white flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="critical">{ap("filterUrgent")}</TabsTrigger>
            <TabsTrigger value="flood">{ap("filterFlood")}</TabsTrigger>
            <TabsTrigger value="aqi">{ap("filterAqi")}</TabsTrigger>
          </TabsList>

          {TABS.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {filtered.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <Bell className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{ap("empty")}</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
