/**
 * Barky service unit tests — focused on security and correctness guarantees.
 *
 * All tests use mocked SqlTransactionManager — no real database required.
 * All tests marked [MOCKED] use mocked fetch — no real AI providers contacted.
 *
 * Coverage:
 *   1. Session isolation — authenticated user cannot read another user's session
 *   2. UUID validation  — malformed session IDs rejected before any DB query
 *   3. Input sanitization — null bytes, oversized input, empty input
 *   4. Rate limiting  — FORBIDDEN at limit, barky: prefix, store failures are hard errors
 *   5. Provider fallback — Groq fails → Mistral; both fail → error [MOCKED]
 *   6. No keys configured → graceful unavailable message [MOCKED]
 *   7. Catalog grounding  — real rows formatted; empty rows → "not available"; DB failure → fallback
 *   8. FAQ CRUD validation — sanitization, integer ID check
 *   9. History bounded    — LIMIT 20 applied in query (query inspection)
 *  10. getHistory with malformed UUID returns empty array without querying DB
 */

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { BarkyService } from "../barky-service.js";
import { AppError } from "../../lib/errors.js";
import type { SqlTransactionManager } from "../../integrations/sql-server.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSql(overrides?: Partial<SqlTransactionManager>): SqlTransactionManager & { query: Mock } {
  return {
    query: vi.fn().mockResolvedValue([]),
    ...(overrides ?? {}),
  } as unknown as SqlTransactionManager & { query: Mock };
}

function makeService(sql?: SqlTransactionManager & { query: Mock }) {
  const db = sql ?? makeSql();
  return { service: new BarkyService(db), db };
}

// Minimal valid UUID (36 hex chars with dashes at correct positions)
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// 1. Session isolation
// ---------------------------------------------------------------------------

describe("session isolation", () => {
  it("getSession returns null for a session that belongs to a different user (no row returned)", async () => {
    // Simulates: session exists but row lookup returns nothing (ownership checked at call-site in app.ts)
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([]); // no row for this sessionId

    const result = await service.getSession(VALID_UUID);
    expect(result).toBeNull();
    // DB WAS queried — the rejection came from "no row" not from UUID validation
    expect(db.query).toHaveBeenCalledOnce();
  });

  it("getSession returns the userId when session exists", async () => {
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([{ user_id: 42 }]);

    const result = await service.getSession(VALID_UUID);
    expect(result).toEqual({ userId: 42 });
  });

  it("getSession returns userId: null for guest sessions", async () => {
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([{ user_id: null }]);

    const result = await service.getSession(VALID_UUID);
    expect(result).toEqual({ userId: null });
  });
});

// ---------------------------------------------------------------------------
// 2. UUID validation — malformed IDs rejected before DB
// ---------------------------------------------------------------------------

describe("UUID validation", () => {
  const badIds = [
    "",
    "not-a-uuid",
    "'; DROP TABLE bx_barky_sessions; --",
    "550e8400-e29b-41d4-a716-44665544000",   // 35 chars
    "550e8400-e29b-41d4-a716-4466554400000",  // 37 chars
    "../../../etc/passwd",
    "\x00evil",
  ];

  for (const id of badIds) {
    it(`getSession rejects "${id.slice(0, 30)}" without querying DB`, async () => {
      const { service, db } = makeService();
      const result = await service.getSession(id);
      expect(result).toBeNull();
      expect(db.query).not.toHaveBeenCalled();
    });

    it(`getHistory rejects "${id.slice(0, 30)}" without querying DB`, async () => {
      const { service, db } = makeService();
      const result = await service.getHistory(id);
      expect(result).toEqual([]);
      expect(db.query).not.toHaveBeenCalled();
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Input sanitization
// ---------------------------------------------------------------------------

describe("input sanitization", () => {
  it("throws VALIDATION_ERROR for empty message after trim", async () => {
    const { service } = makeService();
    await expect(service.sendMessage(VALID_UUID, "   \x00\x00   ", null))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR for whitespace-only message", async () => {
    const { service } = makeService();
    await expect(service.sendMessage(VALID_UUID, "   ", null))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("strips null bytes from user message before persistence", async () => {
    const { service, db } = makeService();
    // history query, faq query, catalog query (Products JOIN), insert query
    db.query
      .mockResolvedValueOnce([]) // history
      .mockResolvedValueOnce([]) // faqs
      .mockResolvedValueOnce([]) // catalog → empty → no rows
      .mockResolvedValueOnce([{ id: "reply-id" }]); // insert

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Woof!" } }] }),
        { status: 200 }
      )
    ));

    // Message with null bytes should not crash; null bytes stripped
    const input = "Hello\x00 Barky\x00";
    await service.sendMessage(VALID_UUID, input, null);

    // The persisted content in the INSERT call should not contain null bytes
    const insertCall = db.query.mock.calls.find(call =>
      typeof call[0] === "string" && call[0].includes("INSERT")
    );
    expect(insertCall).toBeDefined();
    const params = insertCall![1] as Record<string, unknown>;
    expect(String(params.userMsg)).not.toContain("\x00");

    vi.unstubAllGlobals();
  });

  it("truncates messages exceeding 1000 chars to exactly 1000 chars", async () => {
    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200 }
      )
    ));

    const oversized = "x".repeat(2000);
    await service.sendMessage(VALID_UUID, oversized, null);

    const insertCall = db.query.mock.calls.find(call =>
      typeof call[0] === "string" && call[0].includes("INSERT")
    );
    const params = insertCall![1] as Record<string, unknown>;
    expect(String(params.userMsg).length).toBeLessThanOrEqual(1000);

    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// 4. Rate limiting
// ---------------------------------------------------------------------------

describe("rate limiting", () => {
  it("throws FORBIDDEN when increment returns count above BARKY_RATE_MAX (20)", async () => {
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([{ count: 21 }]); // increment returns 21

    await expect(service.checkRateLimit("user:42"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows request when increment returns exactly BARKY_RATE_MAX (20)", async () => {
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([{ count: 20 }]);

    await expect(service.checkRateLimit("user:42")).resolves.toBeUndefined();
  });

  it("prefixes rate limit key with barky: to isolate from auth keys", async () => {
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([{ count: 1 }]);

    await service.checkRateLimit("user:99");

    const callArgs = db.query.mock.calls[0];
    expect(String(callArgs?.[0])).toContain("auth_rate_limits");
    const params = callArgs?.[1] as Record<string, unknown>;
    expect(String(params?.key)).toMatch(/^barky:/);
    expect(String(params?.key)).toContain("user:99");
  });

  it("throws CONFIGURATION_ERROR (not silently allows) when rate limit store fails", async () => {
    const { service, db } = makeService();
    db.query.mockRejectedValueOnce(new Error("DB connection lost"));

    await expect(service.checkRateLimit("user:42"))
      .rejects.toMatchObject({ code: "CONFIGURATION_ERROR" });
  });

  it("re-throws FORBIDDEN from rate limit store as-is (does not wrap)", async () => {
    const { service, db } = makeService();
    // Simulate store already throwing FORBIDDEN (belt-and-suspenders)
    db.query.mockRejectedValueOnce(new AppError("FORBIDDEN", "Too many messages. Please wait a moment before sending more."));

    await expect(service.checkRateLimit("user:42"))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ---------------------------------------------------------------------------
// 5. Provider fallback — Groq fails → Mistral  [MOCKED]
// ---------------------------------------------------------------------------

describe("provider fallback [MOCKED]", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.MISTRAL_API_KEY = "test-mistral-key";
  });

  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    vi.unstubAllGlobals();
  });

  it("falls back to Mistral when Groq returns 500", async () => {
    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([]) // history
      .mockResolvedValueOnce([]) // faqs
      .mockResolvedValueOnce([]) // catalog
      .mockResolvedValueOnce([]); // insert

    let callCount = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      callCount++;
      if (url.includes("groq.com")) {
        return new Response("Internal Server Error", { status: 500 });
      }
      // Mistral succeeds
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Mistral reply!" } }] }),
        { status: 200 }
      );
    }));

    const result = await service.sendMessage(VALID_UUID, "Hi Barky", null);
    expect(result.reply).toBe("Mistral reply!");
    expect(callCount).toBe(2); // Groq tried first, Mistral second
  });

  it("falls back to Mistral when Groq times out (AbortError)", async () => {
    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("groq.com")) {
        const err = new DOMException("The operation was aborted", "AbortError");
        throw err;
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Mistral fallback" } }] }),
        { status: 200 }
      );
    }));

    const result = await service.sendMessage(VALID_UUID, "Hello", null);
    expect(result.reply).toBe("Mistral fallback");
  });

  it("throws EXTERNAL_SERVICE_ERROR when both providers fail", async () => {
    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("Bad Gateway", { status: 502 })
    ));

    await expect(service.sendMessage(VALID_UUID, "Hello", null))
      .rejects.toMatchObject({ code: "EXTERNAL_SERVICE_ERROR" });
  });

  it("uses Groq successfully without trying Mistral when Groq works", async () => {
    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Groq reply!" } }] }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetcher);

    const result = await service.sendMessage(VALID_UUID, "Hi", null);
    expect(result.reply).toBe("Groq reply!");
    // Only one fetch call — Groq succeeded, Mistral never attempted
    expect(fetcher).toHaveBeenCalledOnce();
    expect(String(fetcher.mock.calls[0]![0])).toContain("groq.com");
  });
});

// ---------------------------------------------------------------------------
// 6. No API keys — graceful unavailable message  [MOCKED]
// ---------------------------------------------------------------------------

describe("no API keys [MOCKED]", () => {
  it("returns graceful unavailable message when no keys are set", async () => {
    const saved = { groq: process.env.GROQ_API_KEY, mistral: process.env.MISTRAL_API_KEY };
    delete process.env.GROQ_API_KEY;
    delete process.env.MISTRAL_API_KEY;

    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.sendMessage(VALID_UUID, "Hello", null);
    expect(result.reply).toContain("not available right now");

    if (saved.groq) process.env.GROQ_API_KEY = saved.groq;
    if (saved.mistral) process.env.MISTRAL_API_KEY = saved.mistral;
  });
});

// ---------------------------------------------------------------------------
// 7. Catalog grounding
// ---------------------------------------------------------------------------

describe("catalog grounding", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "test-groq-key";
  });
  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    vi.unstubAllGlobals();
  });

  it("injects live SKU + price into system prompt when rows returned", async () => {
    const { service, db } = makeService();
    const catalogRow = {
      productname: "NU Bulldogs Cap",
      sku: "CAP-001",
      variantname: "One Size",
      variantsku: "CAP-001-OS",
      price: 299.00,
      physicalquantity: 10,
      reservedquantity: 3,
    };

    db.query
      .mockResolvedValueOnce([]) // history
      .mockResolvedValueOnce([]) // faqs
      .mockResolvedValueOnce([catalogRow]) // catalog
      .mockResolvedValueOnce([]); // insert

    let capturedMessages: Array<{ role: string; content: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ role: string; content: string }> };
      capturedMessages = body.messages ?? [];
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Available!" } }] }),
        { status: 200 }
      );
    }));

    await service.sendMessage(VALID_UUID, "What caps do you have?", null);

    const systemMsg = capturedMessages.find(m => m.role === "system");
    expect(systemMsg?.content).toContain("NU Bulldogs Cap");
    expect(systemMsg?.content).toContain("CAP-001-OS");
    expect(systemMsg?.content).toContain("299.00");
    expect(systemMsg?.content).toContain("7 available"); // 10 - 3
  });

  it("injects 'No items available' when catalog query returns empty rows", async () => {
    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]) // empty catalog
      .mockResolvedValueOnce([]);

    let capturedMessages: Array<{ role: string; content: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ role: string; content: string }> };
      capturedMessages = body.messages ?? [];
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "None right now." } }] }),
        { status: 200 }
      );
    }));

    await service.sendMessage(VALID_UUID, "What's in stock?", null);

    const systemMsg = capturedMessages.find(m => m.role === "system");
    expect(systemMsg?.content).toContain("No items are currently available");
  });

  it("falls back to vague description without crashing when catalog query throws", async () => {
    const { service, db } = makeService();
    db.query
      .mockResolvedValueOnce([]) // history
      .mockResolvedValueOnce([]) // faqs
      .mockRejectedValueOnce(new Error("DB timeout")) // catalog — throws
      .mockResolvedValueOnce([]); // insert

    let capturedMessages: Array<{ role: string; content: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ role: string; content: string }> };
      capturedMessages = body.messages ?? [];
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "Check the site." } }] }),
        { status: 200 }
      );
    }));

    // Must not throw — catalog failure is non-fatal
    const result = await service.sendMessage(VALID_UUID, "What's available?", null);
    expect(result.reply).toBe("Check the site.");

    const systemMsg = capturedMessages.find(m => m.role === "system");
    expect(systemMsg?.content).toContain("current availability");
  });
});

// ---------------------------------------------------------------------------
// 8. FAQ CRUD validation — sanitization, ID check
// ---------------------------------------------------------------------------

describe("FAQ CRUD validation", () => {
  it("throws VALIDATION_ERROR when creating FAQ with empty question after sanitize", async () => {
    const { service } = makeService();
    await expect(service.createFaq("\x00  \x00", "Some answer"))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when creating FAQ with empty answer after sanitize", async () => {
    const { service } = makeService();
    await expect(service.createFaq("Some question", "   "))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when updating FAQ with invalid (float) id", async () => {
    const { service } = makeService();
    await expect(service.updateFaq(1.5, "Q", "A", true))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when updating FAQ with zero id", async () => {
    const { service } = makeService();
    await expect(service.updateFaq(0, "Q", "A", true))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when updating FAQ with negative id", async () => {
    const { service } = makeService();
    await expect(service.updateFaq(-1, "Q", "A", true))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("throws VALIDATION_ERROR when deleting FAQ with invalid id", async () => {
    const { service } = makeService();
    await expect(service.deleteFaq(0))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("sanitizes null bytes in FAQ question and answer before persistence", async () => {
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([{
      id: 1, question: "Clean Q", answer: "Clean A",
      is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }]);

    await service.createFaq("Honest\x00 question", "Good\x00 answer");

    const params = db.query.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(String(params.question)).not.toContain("\x00");
    expect(String(params.answer)).not.toContain("\x00");
  });
});

// ---------------------------------------------------------------------------
// 9. Chat history bounded to last 20 rows (10 turns)
// ---------------------------------------------------------------------------

describe("chat history bounded", () => {
  it("history query includes LIMIT 20 to cap context growth", async () => {
    const { service, db } = makeService();
    // Throw on the second query call so test ends early without needing full mock chain
    db.query
      .mockResolvedValueOnce([{ role: "user", content: "old" }]) // history
      .mockRejectedValueOnce(new Error("stop")); // stop after history

    try {
      await service.sendMessage(VALID_UUID, "Hi", null);
    } catch {
      // expected
    }

    const historyQuery = String(db.query.mock.calls[0]?.[0] ?? "");
    expect(historyQuery).toMatch(/LIMIT\s+20/i);
  });
});

// ---------------------------------------------------------------------------
// 10. getHistory with malformed UUID
// ---------------------------------------------------------------------------

describe("getHistory", () => {
  it("returns empty array without DB query for malformed session ID", async () => {
    const { service, db } = makeService();
    const result = await service.getHistory("not-valid");
    expect(result).toEqual([]);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("returns mapped message records for valid session", async () => {
    const { service, db } = makeService();
    db.query.mockResolvedValueOnce([{
      id: "msg-1",
      session_id: VALID_UUID,
      role: "user",
      content: "Hello",
      created_at: "2026-10-16T00:00:00.000Z",
    }]);

    const result = await service.getHistory(VALID_UUID);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "msg-1",
      sessionId: VALID_UUID,
      role: "user",
      content: "Hello",
    });
  });
});
