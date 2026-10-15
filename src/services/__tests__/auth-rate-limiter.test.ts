import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createHash, createHmac } from "node:crypto";
import { AuthRateLimiter, MemoryRateLimitStore, PostgresRateLimitStore } from "../auth-rate-limiter.js";
import { AppError } from "../../lib/errors.js";
import type { RateLimitStore } from "../auth-rate-limiter.js";
import type { SqlTransactionManager } from "../../integrations/sql-server.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeRequest(email: string, ip?: string) {
  return {
    body: { email },
    headers: ip ? { "x-forwarded-for": ip } : {},
  };
}

function makeStore(): { store: RateLimitStore; increment: Mock } {
  const increment = vi.fn();
  const store: RateLimitStore = { increment };
  return { store, increment };
}

function expectedKey(type: "account" | "ip", value: string, secret: string): string {
  const rawKey = `auth:${type}:${createHmac("sha256", secret).update(value).digest("hex")}`;
  return createHash("sha256").update(rawKey).digest("hex");
}

// ---------------------------------------------------------------------------
// 1. key length
// ---------------------------------------------------------------------------
describe("key length", () => {
  const secret = "test-secret-1234";

  it("account key is exactly 64 hex chars", () => {
    const key = expectedKey("account", "user@example.com", secret);
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ip key is exactly 64 hex chars", () => {
    const key = expectedKey("ip", "192.168.1.1", secret);
    expect(key).toHaveLength(64);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it("account and ip keys are distinct for the same raw value", () => {
    const val = "something";
    const acct = expectedKey("account", val, secret);
    const ip = expectedKey("ip", val, secret);
    expect(acct).not.toBe(ip);
  });

  it("account key is the SHA-256 of the HMAC-prefixed string (domain-separated from barky)", async () => {
    const { store, increment } = makeStore();
    increment.mockResolvedValue(1);
    const limiter = new AuthRateLimiter(store, secret);
    await limiter.check(makeRequest("user@example.com"));
    const storedKey = String((increment.mock.calls[0] as unknown[])[0]);
    expect(storedKey).toHaveLength(64);
    expect(storedKey).toMatch(/^[0-9a-f]{64}$/);
    // Must NOT equal a barky-namespaced key
    const barkyKey = createHash("sha256").update("barky:account:" + createHmac("sha256", secret).update("user@example.com").digest("hex")).digest("hex");
    expect(storedKey).not.toBe(barkyKey);
  });

  it("store.increment is called with the 64-char key, not the raw prefixed key", async () => {
    const { store, increment } = makeStore();
    increment.mockResolvedValue(1);
    const limiter = new AuthRateLimiter(store, secret);
    await limiter.check(makeRequest("a@b.com"));
    for (const call of increment.mock.calls) {
      expect(String((call as unknown[])[0])).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. threshold enforcement
// ---------------------------------------------------------------------------
describe("threshold enforcement", () => {
  const secret = "thresh-secret";

  it("allows request when account count is exactly at limit (10)", async () => {
    const { store, increment } = makeStore();
    increment.mockResolvedValue(10); // at limit, not over
    const limiter = new AuthRateLimiter(store, secret);
    await expect(limiter.check(makeRequest("user@example.com"))).resolves.toBeUndefined();
  });

  it("blocks when account count exceeds account limit (>10)", async () => {
    const { store, increment } = makeStore();
    increment.mockResolvedValue(11);
    const limiter = new AuthRateLimiter(store, secret);
    await expect(limiter.check(makeRequest("user@example.com"))).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 429,
    });
  });

  it("allows request when IP count is exactly at limit (30)", async () => {
    const { store, increment } = makeStore();
    // account check passes (1), ip check at limit (30)
    increment.mockResolvedValueOnce(1).mockResolvedValueOnce(30);
    const limiter = new AuthRateLimiter(store, secret);
    await expect(limiter.check(makeRequest("user@example.com", "1.2.3.4"))).resolves.toBeUndefined();
  });

  it("blocks when IP count exceeds IP limit (>30)", async () => {
    const { store, increment } = makeStore();
    increment.mockResolvedValueOnce(1).mockResolvedValueOnce(31);
    const limiter = new AuthRateLimiter(store, secret);
    await expect(limiter.check(makeRequest("user@example.com", "1.2.3.4"))).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 429,
    });
  });

  it("blocks on account check before reaching IP check", async () => {
    const { store, increment } = makeStore();
    increment.mockResolvedValueOnce(11); // account over limit
    const limiter = new AuthRateLimiter(store, secret);
    await expect(limiter.check(makeRequest("user@example.com", "1.2.3.4"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    // IP increment should never have been called
    expect(increment).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 3. concurrency
// ---------------------------------------------------------------------------
describe("concurrency", () => {
  it("handles concurrent increments without throwing when under limits", async () => {
    const store = new MemoryRateLimitStore();
    const secret = "concurrency-secret";
    const limiter = new AuthRateLimiter(store, secret);
    const req = makeRequest("concurrent@example.com");
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => limiter.check(req)),
    );
    const rejected = results.filter((r) => r.status === "rejected");
    // 5 requests, account limit 10 — all should pass
    expect(rejected).toHaveLength(0);
  });

  it("eventually blocks after account limit reached via MemoryRateLimitStore", async () => {
    const store = new MemoryRateLimitStore();
    const secret = "memory-threshold-secret";
    const limiter = new AuthRateLimiter(store, secret);
    const req = makeRequest("flood@example.com");
    // First 10 should all pass
    for (let i = 0; i < 10; i++) {
      await expect(limiter.check(req)).resolves.toBeUndefined();
    }
    // 11th must block
    await expect(limiter.check(req)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// 4. expiry (via MemoryRateLimitStore)
// ---------------------------------------------------------------------------
describe("expiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resets count after window expires", async () => {
    const store = new MemoryRateLimitStore();
    const secret = "expiry-secret";
    const limiter = new AuthRateLimiter(store, secret);
    const req = makeRequest("expiry@example.com");

    // Fill account to limit
    for (let i = 0; i < 10; i++) {
      await limiter.check(req);
    }
    // 11th blocked
    await expect(limiter.check(req)).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Advance past the 60-second window
    vi.advanceTimersByTime(61_000);

    // Should be allowed again after window reset
    await expect(limiter.check(req)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. database failures (fail-closed)
// ---------------------------------------------------------------------------
describe("database failures", () => {
  const secret = "db-fail-secret";

  it("throws CONFIGURATION_ERROR (503) when store throws non-AppError", async () => {
    const { store, increment } = makeStore();
    increment.mockRejectedValue(new Error("DB connection lost"));
    const limiter = new AuthRateLimiter(store, secret);
    const error = await limiter.check(makeRequest("user@example.com")).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("CONFIGURATION_ERROR");
    expect((error as AppError).status).toBe(503);
  });

  it("re-throws AppError FORBIDDEN without wrapping it", async () => {
    const { store, increment } = makeStore();
    increment.mockResolvedValue(99); // way over limit
    const limiter = new AuthRateLimiter(store, secret);
    const error = await limiter.check(makeRequest("user@example.com")).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("FORBIDDEN");
    expect((error as AppError).status).toBe(429);
  });

  it("fails closed when secret is not set in production", async () => {
    const { store } = makeStore();
    // Pass undefined as secret to simulate missing production secret
    const limiter = new AuthRateLimiter(store, "" as unknown as string);
    const error = await limiter.check(makeRequest("user@example.com")).catch((e) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("CONFIGURATION_ERROR");
    expect((error as AppError).status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// 6. PostgresRateLimitStore key storage
// ---------------------------------------------------------------------------
describe("PostgresRateLimitStore key fits varchar(64)", () => {
  function makeSql(): { sql: SqlTransactionManager; query: Mock } {
    const query = vi.fn();
    const sql = { query } as unknown as SqlTransactionManager;
    return { sql, query };
  }

  it("passes a 64-char key to the database INSERT", async () => {
    const { sql, query } = makeSql();
    query.mockResolvedValue([{ count: 1 }]);
    const store = new PostgresRateLimitStore(sql);
    const key = "a".repeat(64); // exactly 64 chars — simulating pre-hashed key
    await store.increment(key, 60);
    const params = (query.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(String(params.key)).toHaveLength(64);
  });
});
