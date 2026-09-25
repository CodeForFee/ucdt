import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import { routes } from "./routes";
import messages from "@/messages/vi.json";

// Every page is lazy-loaded, and the first route in this file pays the cold import of its
// chunk (the dashboard pulls recharts). On a cold CI runner that exceeded findBy's 1 s
// default (PR #33, 1137 ms); the page is correct, the wait was just too short.
// 4 s stays under vitest's 5 s per-test timeout, so a real miss still fails as a findBy error.
const LAZY = { timeout: 4000 };

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="vi" messages={messages}>
        <RouterProvider router={router} />
      </IntlProvider>
    </QueryClientProvider>,
  );
}

describe("routes", () => {
  const cases: Array<[string, string]> = [
    ["/dashboard", "Tổng quan"],
    ["/map", "Bản đồ"],
    ["/simulation", "Mô phỏng"],
    ["/simulation/heat", "Kịch bản Nhiệt độ"],
    ["/simulation/flood", "Kịch bản Ngập lụt"],
    ["/simulation/aqi", "Kịch bản Chất lượng Không khí"],
    ["/risks/flood", "Nguy cơ ngập lụt"],
    ["/risks/heat", "Nguy cơ nắng nóng"],
    ["/risks/aqi", "Chất lượng không khí"],
    ["/flood", "Nguy cơ ngập lụt"], // legacy URL, redirects to /risks/flood
    ["/air-quality", "Chất lượng không khí"], // legacy URL, redirects to /risks/aqi
    ["/alerts", "Cảnh báo"],
    ["/recommendations", "Khuyến nghị"],
  ];

  it.each(cases)("renders the placeholder for %s inside the layout", async (path, heading) => {
    renderAt(path);

    expect(await screen.findByRole("heading", { name: heading }, LAZY)).toBeInTheDocument();
    // Proves the page rendered inside AppLayout, not standalone — the Header's nav
    // brand is only mounted by the layout.
    expect(screen.getByRole("link", { name: /Urban Climate DT/i })).toBeInTheDocument();
  });

  it("the nav carries four tabs, Risks merging Flood+Recommendations (user decision 2026-09-25)", async () => {
    renderAt("/risks/flood");
    await screen.findByRole("heading", { name: "Nguy cơ ngập lụt" }, LAZY);
    const nav = screen.getByRole("navigation");
    const tabs = within(nav).getAllByRole("link");
    expect(tabs.map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard",
      "/map",
      "/simulation",
      "/risks",
    ]);
    expect(within(nav).getByRole("link", { name: /Rủi ro/ }).className).toContain("text-primary"); // active
    // Alerts moved from the overview into the header bell.
    expect(screen.getByRole("button", { name: "Mở cảnh báo" })).toBeInTheDocument();
  });

  it("the /risks sub-tab bar carries Flood/Heat/AQI and each embeds alerts+recommendations", async () => {
    renderAt("/risks/heat");
    await screen.findByRole("heading", { name: "Nguy cơ nắng nóng" }, LAZY);
    expect(screen.getByRole("link", { name: "Ngập lụt" })).toHaveAttribute("href", "/risks/flood");
    expect(screen.getByRole("link", { name: "Nhiệt độ" })).toHaveAttribute("href", "/risks/heat");
    expect(screen.getByRole("link", { name: "Chất lượng Không khí" })).toHaveAttribute("href", "/risks/aqi");
  });

  it("redirects / to /dashboard", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Tổng quan" }, LAZY)).toBeInTheDocument();
  });

  it("renders the not-found page for an unmatched URL", async () => {
    renderAt("/this-route-does-not-exist");
    expect(await screen.findByText("Trang không tồn tại.", undefined, LAZY)).toBeInTheDocument();
  });
});
