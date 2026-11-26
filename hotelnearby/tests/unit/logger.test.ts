import { describe, expect, it } from "vitest";

import { redact } from "@/lib/logger";

describe("redact", () => {
  it("hides sensitive keys at any depth", () => {
    const out = redact({
      user: "ada",
      paystack_secret_key: "sk_live_x",
      nested: { Authorization: "Bearer abc", cookie: "c", ok: 1 },
      list: [{ password: "p" }],
    }) as Record<string, unknown>;

    expect(out.user).toBe("ada");
    expect(out.paystack_secret_key).toBe("[redacted]");
    expect(out.nested).toEqual({ Authorization: "[redacted]", cookie: "[redacted]", ok: 1 });
    expect(out.list).toEqual([{ password: "[redacted]" }]);
  });

  it("serialises errors without throwing", () => {
    const out = redact(new Error("boom")) as { message: string };
    expect(out.message).toBe("boom");
  });
});
