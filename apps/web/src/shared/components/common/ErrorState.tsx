import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslations } from "use-intl";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function ErrorState({ message, onRetry, compact = false }: ErrorStateProps) {
  const t = useTranslations("error");
  const msg = message ?? t("loadFailed");

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-destructive text-sm">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{msg}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 px-2 ml-1">
            <RefreshCw className="h-3 w-3 mr-1" />
            {t("retry")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground text-center max-w-xs">{msg}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("retry")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
