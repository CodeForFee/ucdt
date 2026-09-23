// Matches BE AlertsResponse exactly
export interface AlertsResponse {
  alerts: Alert[];
  unreadCount: number;
  totalCount: number;
}

export interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  type: "flood" | "aqi" | "heat" | "storm" | "system";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  expiresAt: string;
}
