import { create } from "zustand";
import type { Alert } from "@/shared/types/alert";

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  setAlerts: (alerts: Alert[]) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  addAlert: (alert: Alert) => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  alerts: [],
  unreadCount: 0,
  setAlerts: (alerts) =>
    set({
      alerts,
      unreadCount: alerts.filter((a) => !a.isRead).length,
    }),
  markAsRead: (id) =>
    set((s) => {
      const updated = s.alerts.map((a) => (a.id === id ? { ...a, isRead: true } : a));
      return { alerts: updated, unreadCount: updated.filter((a) => !a.isRead).length };
    }),
  markAllRead: () =>
    set((s) => ({
      alerts: s.alerts.map((a) => ({ ...a, isRead: true })),
      unreadCount: 0,
    })),
  addAlert: (alert) =>
    set((s) => {
      const updated = [alert, ...s.alerts];
      return { alerts: updated, unreadCount: updated.filter((a) => !a.isRead).length };
    }),
}));
