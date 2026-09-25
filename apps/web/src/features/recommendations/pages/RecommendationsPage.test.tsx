import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
import enMessages from "@/messages/en.json";
import { recommend } from "@/test/fixtures";

vi.mock("@/shared/hooks/useRecommend", () => ({
  useRecommend: () => ({ data: recommend, isLoading: false, isError: false, refetch: () => {} }),
}));
const { default: RecommendationsPage } = await import("./RecommendationsPage");

function renderPage() {
  return render(
    <IntlProvider locale="vi" messages={messages}>
      <RecommendationsPage />
    </IntlProvider>,
  );
}

describe("RecommendationsPage (own tab, §E/§J)", () => {
  it("lists every ranked item with toponym and a locale-rendered title/message (no raw π/formula)", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Khuyến nghị" })).toBeInTheDocument();
    // Nested action-item <li>s don't start with the "#<rank>" marker; only the top-level cards do.
    const items = screen.getAllByRole("listitem").filter((li) => /^#\d/.test(li.textContent ?? ""));
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("#1");
    expect(items[0]).toHaveTextContent("Ung Văn Khiêm");
    expect(items[0]).toHaveTextContent("Theo dõi tình hình mưa");
    expect(items[0]).toHaveTextContent("điểm rủi ro 33%");
    expect(items[0]).not.toHaveTextContent("π =");
    expect(items[0]).not.toHaveTextContent("R-FLOOD-03");
    expect(items[1]).toHaveTextContent("Nhiệt độ hiệu dụng tại Phước Kiển cao (37.4°C)");
  });

  it("renders the recommendation text in English when the locale is English", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <RecommendationsPage />
      </IntlProvider>,
    );
    const items = screen.getAllByRole("listitem").filter((li) => /^#\d/.test(li.textContent ?? ""));
    expect(items[0]).toHaveTextContent("Monitor rainfall conditions");
    expect(items[0]).toHaveTextContent("risk score 33%");
    expect(items[0]).not.toHaveTextContent("Theo dõi tình hình mưa");
  });

  it("states how many (rule, unit) pairs fired beyond the top k", () => {
    renderPage();
    expect(screen.getByText("Top 3 / 14 cặp (luật, đơn vị) kích hoạt")).toBeInTheDocument();
  });

  it("never renders the commune (§A.3), nor the internal AQI-point join key", () => {
    const text = renderPage().container.textContent ?? "";
    expect(text).not.toContain("Phường");
    expect(text).not.toContain("Xã Nhà Bè");
    expect(text).not.toContain("station-q8");
  });
});
