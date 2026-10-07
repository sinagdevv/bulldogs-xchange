import { afterEach, expect, it, vi } from "vitest";
import { PowerAutomateClient } from "../src/integrations/power-automate-client.js";

afterEach(() => delete process.env.PA_CREATE_RESERVATION_URL);
it("calls the configured workflow and keeps the URL server-side", async () => { process.env.PA_CREATE_RESERVATION_URL = "https://example.test/workflow"; const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: "ok" }), { status: 200, headers: { "content-type": "application/json" } })); const result = await new PowerAutomateClient(fetcher as typeof fetch).createReservation({ quantity: 1 }); expect(result).toEqual({ id: "ok" }); expect(fetcher).toHaveBeenCalledWith(process.env.PA_CREATE_RESERVATION_URL, expect.objectContaining({ method: "POST" })); });

