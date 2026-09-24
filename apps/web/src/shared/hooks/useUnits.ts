import { useQuery } from "@tanstack/react-query";
import { fetchUnits } from "@/shared/services";
import { QUERY_KEY } from "@/shared/utils/queryKeys";

/** unit id → toponym. The units are static layers (§A), so this is fetched once. Only
 *  `name` is exposed: `commune` never reaches a component (§A.3). */
export function useUnitNames() {
  return useQuery({
    queryKey: QUERY_KEY.units(),
    queryFn: fetchUnits,
    staleTime: Infinity,
    select: (rows) => new Map(rows.map((u) => [u.id, u.name])),
  });
}
