import { apiClient, unwrap } from "@/shared/lib/axios";
import type { components } from "@ucdt/contracts";

/** One spatial unit (§A.3 mapping table). `commune` is data only: the web never renders it. */
export type UnitRow = components["schemas"]["UnitRow"];

export const fetchUnits = (): Promise<UnitRow[]> => apiClient.get("/api/units").then(unwrap<UnitRow[]>);
