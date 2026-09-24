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
    ["/flood", "Nguy cơ ngập lụt"],
    ["/air-quality", "Chất lượng không khí"],
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

  it("the nav carries five tabs, Recommendations included (user decision 2026-09-24)", async () => {
    renderAt("/recommendations");
    await screen.findByRole("heading", { name: "Khuyến nghị" }, LAZY);
    const nav = screen.getByRole("navigation");
    const tabs = within(nav).getAllByRole("link");
    expect(tabs.map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard",
      "/map",
      "/simulation",
      "/flood",
      "/recommendations",
    ]);
    expect(within(nav).getByRole("link", { name: /Khuyến nghị/ }).className).toContain("text-primary"); // active
    // Alerts moved from the overview into the header bell.
    expect(screen.getByRole("button", { name: "Mở cảnh báo" })).toBeInTheDocument();
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
