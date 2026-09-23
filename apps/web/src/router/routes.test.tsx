import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import { routes } from "./routes";
import messages from "@/messages/vi.json";

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
  ];

  it.each(cases)("renders the placeholder for %s inside the layout", async (path, heading) => {
    renderAt(path);

    expect(await screen.findByRole("heading", { name: heading })).toBeInTheDocument();
    // Proves the page rendered inside AppLayout, not standalone — the Header's nav
    // brand is only mounted by the layout.
    expect(screen.getByRole("link", { name: /Urban Climate DT/i })).toBeInTheDocument();
  });

  it("redirects / to /dashboard", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Tổng quan" })).toBeInTheDocument();
  });

  it("renders the not-found page for an unmatched URL", async () => {
    renderAt("/this-route-does-not-exist");
    expect(await screen.findByText("Trang không tồn tại.")).toBeInTheDocument();
  });
});
