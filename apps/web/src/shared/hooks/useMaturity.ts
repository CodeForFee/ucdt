import { useQuery } from "@tanstack/react-query";
import { fetchMaturity } from "@/shared/services";
import { QUERY_KEY } from "@/shared/utils/queryKeys";
import type { MaturityResponse } from "@/shared/types/maturity";

/** Algorithm 1 per hazard (§H). The gateway caches it 600 s; an aqi snapshot.updated
 *  invalidates it (useLiveEvents). */
export function useMaturity() {
  return useQuery<MaturityResponse>({
    queryKey: QUERY_KEY.maturity(),
    queryFn: fetchMaturity,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });
}
