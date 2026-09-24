import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
import * as fx from "@/test/fixtures";
import type { AlertsResponse } from "@/shared/types/alert";
import { useAlertStore } from "@/shared/stores/alertStore";

let served: AlertsResponse = fx.alerts;
const markAlertsRead = vi.fn((ids: string[]) => Promise.resolve({ marked: ids.length }));
vi.mock("@/shared/services/alerts.service", () => ({
  fetchAlerts: () => Promise.resolve(served),
  markAlertsRead: (ids: string[]) => markAlertsRead(ids),
}));
vi.mock("@/shared/services/units.service", () => ({ fetchUnits: () => Promise.resolve(fx.units) }));

const { AlertsBell } = await import("./AlertsBell");

const second = {
  ...fx.alerts.alerts[0],
  id: "heat:nhabe:critical:2026-09-24T15",
  type: "heat" as const,
  severity: "critical" as const,
  title: "Nắng nóng cực đoan",
  message: "T_eff 41 °C",
};

function renderBell() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <IntlProvider locale="vi" messages={messages}>
          <AlertsBell />
        </IntlProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AlertsBell (header, per-unit alerts)", () => {
  beforeEach(() => {
    served = { alerts: [fx.alerts.alerts[0], second], unreadCount: 2, totalCount: 2 };
    useAlertStore.getState().setAlerts([]);
    markAlertsRead.mockClear();
  });

  it("badges the unread count", async () => {
    renderBell();
    expect(await screen.findByTestId("alerts-badge")).toHaveTextContent("2");
  });

  it("opens a dropdown listing each alert with title, toponym, severity and time — never the commune", async () => {
    renderBell();
    await screen.findByTestId("alerts-badge");
    fireEvent.click(screen.getByRole("button", { name: "Mở cảnh báo" }));
    const dialog = screen.getByRole("dialog");
    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    await waitFor(() => expect(items[0]).toHaveTextContent("Ung Văn Khiêm")); // toponym via /api/units
    expect(items[0]).toHaveTextContent("Nguy cơ ngập tại Ung Văn Khiêm");
    expect(items[0]).toHaveTextContent("Cảnh báo");
    expect(items[1]).toHaveTextContent("Phước Kiển");
    expect(items[1]).toHaveTextContent("Nghiêm trọng");
    expect(dialog.textContent).toMatch(/\d{2}:\d{2}/); // createdAt
    expect(dialog.textContent).not.toMatch(/Phường|Xã|Bình Thạnh|Nhà Bè/);
  });

  it("marks one alert read through POST /api/alerts/read and drops the badge count", async () => {
    renderBell();
    await screen.findByTestId("alerts-badge");
    fireEvent.click(screen.getByRole("button", { name: "Mở cảnh báo" }));
    fireEvent.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "Đã đọc" }));
    await waitFor(() => expect(markAlertsRead).toHaveBeenCalledWith([fx.alerts.alerts[0].id]));
    expect(screen.getByTestId("alerts-badge")).toHaveTextContent("1");
  });

  it("marks all read", async () => {
    renderBell();
    await screen.findByTestId("alerts-badge");
    fireEvent.click(screen.getByRole("button", { name: "Mở cảnh báo" }));
    fireEvent.click(screen.getByRole("button", { name: "Đọc tất cả" }));
    await waitFor(() => expect(markAlertsRead).toHaveBeenCalledWith([fx.alerts.alerts[0].id, second.id]));
    expect(screen.queryByTestId("alerts-badge")).toBeNull();
  });

  it("shows an empty state when no alert is active", async () => {
    served = { alerts: [], unreadCount: 0, totalCount: 0 };
    renderBell();
    fireEvent.click(screen.getByRole("button", { name: "Mở cảnh báo" }));
    expect(await screen.findByText("Không có cảnh báo đang hiệu lực")).toBeInTheDocument();
    expect(screen.queryByTestId("alerts-badge")).toBeNull();
  });
});
