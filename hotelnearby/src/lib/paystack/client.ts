import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env/server";
import { getPublicEnv } from "@/lib/env/public";

const API = "https://api.paystack.co";
export type PaystackTransaction = {
  id: number; reference: string; status: string; amount: number; currency: string;
  channel?: string; paid_at?: string; customer?: { email?: string; customer_code?: string };
  authorization?: { authorization_code?: string; reusable?: boolean; signature?: string; card_type?: string; last4?: string; bank?: string; exp_month?: string; exp_year?: string };
  metadata?: Record<string, unknown>;
};

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { paystackSecretKey } = getServerEnv();
  if (!paystackSecretKey) throw new Error("Paystack is not configured. Add a TEST secret key before using billing.");
  const mode = getServerEnv().paystackMode;
  const appEnv = getPublicEnv().appEnv;
  if (mode === "live" && appEnv !== "production") throw new Error("Live Paystack mode is allowed only in production after explicit release approval.");
  if (mode === "test" && !paystackSecretKey.startsWith("sk_test_")) throw new Error("PAYSTACK_MODE is test, but the configured secret key is not a Paystack test key.");
  if (mode === "live" && !paystackSecretKey.startsWith("sk_live_")) throw new Error("PAYSTACK_MODE is live, but the configured secret key is not a Paystack live key.");
  const response = await fetch(`${API}${path}`, {
    ...init, cache: "no-store",
    headers: { Authorization: `Bearer ${paystackSecretKey}`, "Content-Type": "application/json", ...init.headers },
  });
  const body = await response.json() as { status: boolean; message?: string; data: T };
  if (!response.ok || !body.status) throw new Error(body.message || `Paystack request failed (${response.status}).`);
  return body.data;
}

export function initializeTransaction(input: { email: string; amount: number; reference: string; callback_url: string; metadata: Record<string, unknown>; currency?: string }) {
  return request<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
    method: "POST", body: JSON.stringify({ ...input, currency: input.currency ?? "NGN" }),
  });
}
export function verifyTransaction(reference: string) {
  return request<PaystackTransaction>(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
}
export function chargeAuthorization(input: { authorization_code: string; email: string; amount: number; reference: string; currency?: string; metadata?: Record<string, unknown> }) {
  return request<PaystackTransaction>("/transaction/charge_authorization", { method: "POST", body: JSON.stringify(input) });
}
export function createRefund(input: { transaction: string; amount?: number; merchant_note: string }) {
  return request<{ id: number; reference: string; status: string }>("/refund", { method: "POST", body: JSON.stringify(input) });
}

/** Supports Paystack's current whsec signature and legacy x-paystack-signature. */
export function verifyWebhookSignature(rawBody: string, header: string | null, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!header) return false;
  const { paystackWebhookSecret, paystackSecretKey } = getServerEnv();
  const candidates: string[] = [];
  const fields = header.split(",").map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith("t="))?.slice(2);
  if (timestamp) {
    const t = Number(timestamp);
    if (!Number.isFinite(t) || Math.abs(nowSeconds - t) > 300) return false;
    for (const item of fields.filter((part) => part.startsWith("v1="))) {
      const value = item.slice(3).split(":").at(-1);
      if (value) candidates.push(value);
    }
    if (paystackWebhookSecret) {
      const expected = createHmac("sha512", paystackWebhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
      if (safeEqual(expected, candidates)) return true;
    }
  }
  const legacy = fields.find((part) => /^[a-f0-9]{128}$/i.test(part));
  if (legacy && paystackSecretKey) {
    const expected = createHmac("sha512", paystackSecretKey).update(rawBody).digest("hex");
    return safeEqual(expected, [legacy]);
  }
  return false;
}
function safeEqual(expected: string, candidates: string[]) {
  const a = Buffer.from(expected, "hex");
  return candidates.some((candidate) => {
    if (!/^[a-f0-9]{128}$/i.test(candidate)) return false;
    const b = Buffer.from(candidate, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export function retryRefund(refundId: number, input: { currency: string; account_number: string; bank_id: string }) {
  return request<{ id: number; status: string }>(`/refund/retry_with_customer_details/${refundId}`, { method: "POST", body: JSON.stringify({ refund_account_details: input }) });
}
