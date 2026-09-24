import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import messages from "@/messages/vi.json";
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
  it("lists every ranked item with toponym, rule, π and the rule's inputs (Why this)", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Khuyến nghị" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem").filter((li) => li.textContent?.includes("π ="));
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("#1");
    expect(items[0]).toHaveTextContent("Ung Văn Khiêm");
    expect(items[0]).toHaveTextContent("R-FLOOD-03");
    expect(items[0]).toHaveTextContent("π = 1.46");
    expect(items[0]).toHaveTextContent("Vì sao");
    expect(items[0]).toHaveTextContent("R_f0.33"); // inputs: riskScore
    expect(items[0]).toHaveTextContent("E(i) — tỉ lệ xây dựng (WorldCover)0.91");
    expect(items[1]).toHaveTextContent("T_eff (°C)37.40");
    expect(items[1]).toHaveTextContent("MứcVừa"); // severityBand, translated
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
