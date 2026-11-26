import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, fail, isExpectedError, ok, toSafeError } from "@/lib/errors";
import { runAction } from "@/lib/safe-action";

describe("results", () => {
  it("builds ok and fail results", () => {
    expect(ok(5)).toEqual({ ok: true, data: 5 });
    expect(fail("NOT_FOUND", "Missing")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "Missing" },
    });
  });
});

describe("toSafeError", () => {
  it("passes AppError messages through", () => {
    expect(toSafeError(new AppError("FORBIDDEN", "Not allowed"))).toEqual({
      code: "FORBIDDEN",
      message: "Not allowed",
    });
  });

  it("hides unexpected error details", () => {
    const safe = toSafeError(new Error("connection string postgres://user:pw@host"));
    expect(safe.code).toBe("INTERNAL");
    expect(safe.message).not.toContain("postgres");
  });

  it("maps Zod errors to field errors", () => {
    const parsed = z.object({ email: z.email() }).safeParse({ email: "x" });
    if (parsed.success) throw new Error("expected failure");
    const safe = toSafeError(parsed.error);
    expect(safe.code).toBe("VALIDATION_FAILED");
    expect(safe.fieldErrors?.email?.length).toBeGreaterThan(0);
  });
});

describe("isExpectedError", () => {
  it("treats 4xx AppErrors as expected and 5xx as bugs", () => {
    expect(isExpectedError(new AppError("CONFLICT", "x"))).toBe(true);
    expect(isExpectedError(new AppError("INTERNAL", "x"))).toBe(false);
    expect(isExpectedError(new Error("boom"))).toBe(false);
  });
});

describe("runAction", () => {
  it("returns success results unchanged", async () => {
    expect(await runAction("t", async () => ok("yes"))).toEqual({ ok: true, data: "yes" });
  });

  it("converts thrown errors into safe failures", async () => {
    const result = await runAction("t", async () => {
      throw new Error("secret detail");
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).not.toContain("secret");
  });
});
