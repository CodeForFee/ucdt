import { useQuery } from "@tanstack/react-query";
import { fetchHistory } from "@/shared/services/history.service";
import type { HistoryEntry } from "@/shared/types/history";

export function useHistory<T = unknown>(hazard: string, hours = 24) {
  return useQuery<HistoryEntry<T>[]>({
    queryKey: ["history", hazard, hours],
    queryFn: () => fetchHistory<T>(hazard, hours),
  });
}
