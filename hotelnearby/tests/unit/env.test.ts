import { describe, expect, it } from "vitest";

import { EnvValidationError, parsePublicEnv, parseServerEnv } from "@/lib/env/schema";

describe("parsePublicEnv", () => {
  it("defaults to development with a local site URL", () => {
    const env = parsePublicEnv({});
    expect(env.appEnv).toBe("development");
    expect(env.siteUrl).toBe("http://localhost:3000");
  });

  it("treats blank values as not set", () => {
    const env = parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "", NEXT_PUBLIC_SUPABASE_URL: "  " });
    expect(env.supabaseUrl).toBeUndefined();
  });

  it("requires site and Supabase settings outside development", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_ENV: "production" })).toThrow(EnvValidationError);
    try {
      parsePublicEnv({ NEXT_PUBLIC_APP_ENV: "staging" });
    } catch (error) {
      const issues = (error as EnvValidationError).issues.join("\n");
      expect(issues).toContain("NEXT_PUBLIC_SITE_URL");
      expect(issues).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(issues).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
  });

  it("accepts a complete production configuration", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_APP_ENV: "production",
      NEXT_PUBLIC_SITE_URL: "https://example.com",
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
    });
    expect(env.appEnv).toBe("production");
  });

  it("rejects an unknown environment name and a malformed phone number", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_APP_ENV: "qa" })).toThrow(EnvValidationError);
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPPORT_WHATSAPP: "0803 not a number" })).toThrow(
      EnvValidationError,
    );
  });

  it("never echoes a bad value in its error message", () => {
    try {
      parsePublicEnv({ NEXT_PUBLIC_SITE_URL: "not-a-url-super-secret-value" });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain("super-secret-value");
    }
  });
});

describe("parseServerEnv", () => {
  it("does not require the service-role key in development", () => {
    expect(parseServerEnv({}, "development").supabaseServiceRoleKey).toBeUndefined();
  });

  it("keeps OpenAI credentials and model configuration server-side", () => {
    const env = parseServerEnv({ OPENAI_API_KEY: "server-key", OPENAI_MODEL: "gpt-4o-mini" }, "development");
    expect(env.openaiApiKey).toBe("server-key");
    expect(env.openaiModel).toBe("gpt-4o-mini");
  });

  it("requires the service-role key outside development", () => {
    expect(() => parseServerEnv({}, "production")).toThrow(EnvValidationError);
    expect(
      parseServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "k" }, "production").supabaseServiceRoleKey,
    ).toBe("k");
  });
});
