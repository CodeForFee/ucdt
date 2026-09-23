import { apiClient, unwrap } from "@/shared/lib/axios";
import type { HistoryEntry } from "@/shared/types/history";

export const fetchHistory = <T = unknown>(
  hazard: string,
  hours = 24,
): Promise<HistoryEntry<T>[]> =>
  apiClient
    .get(`/api/history/${hazard}`, { params: { hours } })
    .then(unwrap<HistoryEntry<T>[]>);
