import { describe, it, expect } from "vitest";
import { unwrap } from "./axios";

describe("unwrap", () => {
  it("peels the backend's {success, data, timestamp, cached} envelope", () => {
    const response = {
      data: { success: true, data: { foo: "bar" }, timestamp: "2026-01-01T00:00:00Z", cached: false },
    };
    expect(unwrap(response)).toEqual({ foo: "bar" });
  });

  it("passes through whatever shape .data.data is, without touching it", () => {
    const response = { data: { data: [1, 2, 3] } };
    expect(unwrap(response)).toEqual([1, 2, 3]);
  });
});
