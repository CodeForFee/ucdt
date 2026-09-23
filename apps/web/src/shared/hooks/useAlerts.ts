import { useQuery } from "@tanstack/react-query";
import { fetchAlerts } from "@/shared/services";
import { useCityStore } from "@/shared/stores/cityStore";
import { useAlertStore } from "@/shared/stores/alertStore";
import { useEffect } from "react";
import { QUERY_KEY } from "@/shared/utils/queryKeys";
import type { AlertsResponse } from "@/shared/types/alert";

export function useAlerts() {
  const { selectedCity } = useCityStore();
  const { setAlerts } = useAlertStore();

  const query = useQuery<AlertsResponse>({
    queryKey: QUERY_KEY.alerts(selectedCity.id),
    queryFn: () => fetchAlerts(selectedCity.id),
    staleTime: 1 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) setAlerts(query.data.alerts);
  }, [query.data, setAlerts]);

  return query;
}
