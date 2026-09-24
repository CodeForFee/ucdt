import { apiClient, unwrap } from "@/shared/lib/axios";
import type { MaturityResponse } from "@/shared/types/maturity";

export const fetchMaturity = (): Promise<MaturityResponse> =>
  apiClient.get("/api/maturity").then(unwrap<MaturityResponse>);
