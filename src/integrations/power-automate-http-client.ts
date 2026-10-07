import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "../lib/errors.js";

const envelope = z.union([
  z.object({ success: z.literal(true), reference: z.string().nullable().optional(), message: z.string(), data: z.unknown().optional() }),
  z.object({ success: z.literal(false), error: z.object({ code: z.string(), message: z.string() }) })
]);
export type AutomationResponse<T> = { success: true; reference?: string | null; message: string; data?: T } | { success: false; error: { code: string; message: string } };

export class PowerAutomateHttpClient {
  constructor(private fetcher: typeof fetch = fetch, private timeoutMs = 8000, private log: (entry: Record<string, unknown>) => void = (entry) => console.info(JSON.stringify(entry))) {}
  async request<TRequest, TResponse>(operation: string, url: string | undefined, body: TRequest): Promise<AutomationResponse<TResponse>> {
    if (!url) throw new AppError("CONFIGURATION_ERROR", `${operation} integration is not configured.`);
    const requestId = randomUUID(), secret = process.env.BX_AUTOMATION_SECRET;
    for (let attempt = 0; attempt < 3; attempt++) {
      const started = Date.now(); let response: Response;
      try { response = await this.fetcher(url, { method: "POST", headers: { "content-type": "application/json", "x-bx-request-id": requestId, ...(secret ? { "x-bx-api-key": secret } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) }); }
      catch { throw new AppError("EXTERNAL_SERVICE_ERROR", "Power Automate request timed out or failed."); }
      this.log({ operation, status: response.status, duration: Date.now() - started, requestId });
      if ([429, 502, 503, 504].includes(response.status) && attempt < 2) { const seconds = Number(response.headers.get("retry-after") ?? 0); await new Promise((resolve) => setTimeout(resolve, seconds > 0 ? Math.min(seconds * 1000, 5000) : 100 * (attempt + 1))); continue; }
      let raw: unknown; try { raw = await response.json(); } catch { throw new AppError("EXTERNAL_SERVICE_ERROR", "Power Automate returned an invalid response."); }
      const parsed = envelope.safeParse(raw); if (!parsed.success) throw new AppError("EXTERNAL_SERVICE_ERROR", "Power Automate returned an invalid response.");
      if (!response.ok) { if (!parsed.data.success) throw new AppError("EXTERNAL_SERVICE_ERROR", parsed.data.error.message, response.status); throw new AppError("EXTERNAL_SERVICE_ERROR", "Power Automate request failed.", response.status); }
      if (!parsed.data.success) throw new AppError("EXTERNAL_SERVICE_ERROR", parsed.data.error.message, 422);
      return parsed.data as AutomationResponse<TResponse>;
    }
    throw new AppError("EXTERNAL_SERVICE_ERROR", "Power Automate request failed.");
  }
}
