import { apiClient, unwrap } from "@/shared/lib/axios";
import type { AlertsResponse } from "@/shared/types/alert";

export const fetchAlerts = (city: string): Promise<AlertsResponse> =>
  apiClient.get("/api/alerts", { params: { city } }).then(unwrap<AlertsResponse>);

/**
 * Persist read state on the server. The alert store keeps an optimistic local copy;
 * this is what makes it survive a reload.
 */
export const markAlertsRead = (ids: string[]): Promise<{ marked: number }> =>
  apiClient.post("/api/alerts/read", { ids }).then(unwrap<{ marked: number }>);
