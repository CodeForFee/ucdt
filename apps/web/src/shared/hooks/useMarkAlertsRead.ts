import { useMutation } from "@tanstack/react-query";
import { markAlertsRead } from "@/shared/services/alerts.service";
import { useAlertStore } from "@/shared/stores/alertStore";

/**
 * Mark alerts read, locally and on the server.
 *
 * The store update is optimistic so the UI stays instant; the POST is what makes the
 * state survive a reload.
 *
 * A failed POST rolls the local state back rather than leaving the user believing an
 * alert was dismissed when it was not — these are hazard warnings, so silently losing
 * the correction is the wrong failure mode.
 */
export function useMarkAlertsRead() {
  const { markAsRead, markAllRead, setAlerts, alerts } = useAlertStore();

  return useMutation({
    mutationFn: (ids: string[]) => markAlertsRead(ids),
    onMutate: (ids) => {
      const snapshot = alerts;
      if (ids.length === 1) markAsRead(ids[0]);
      else markAllRead();
      return { snapshot };
    },
    onError: (_err, _ids, context) => {
      if (context?.snapshot) setAlerts(context.snapshot);
    },
  });
}
