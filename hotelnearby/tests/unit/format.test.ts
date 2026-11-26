import { describe, expect, it } from "vitest";

import { cn } from "@/lib/cn";
import { formatNaira } from "@/lib/format";

describe("formatNaira", () => {
  it("formats whole naira from kobo without decimals", () => {
    expect(formatNaira(600000)).toBe("₦6,000");
    expect(formatNaira(10000000)).toBe("₦100,000");
  });

  it("shows kobo only when present", () => {
    expect(formatNaira(600050)).toBe("₦6,000.50");
  });

  it("rejects non-integer kobo", () => {
    expect(() => formatNaira(10.5)).toThrow(RangeError);
  });
});

describe("cn", () => {
  it("joins truthy class names", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});
