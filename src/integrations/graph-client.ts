import { AppError } from "../lib/errors.js";
import type { TokenProvider } from "./microsoft-token-provider.js";
export interface GraphPage<T> { value: T[]; "@odata.nextLink"?: string }
export class GraphClient {
  constructor(private tokens: TokenProvider, private fetcher: typeof fetch = fetch, private timeoutMs = 8000, private log: (entry: Record<string, unknown>) => void = (entry) => console.info(JSON.stringify(entry))) {}
  get<T>(pathOrUrl: string, operation: string, list?: string): Promise<T> { return this.request(pathOrUrl, operation, list); }
  async all<T>(pathOrUrl: string, operation: string, list?: string): Promise<T[]> { const items: T[] = []; let next: string | undefined = pathOrUrl; while (next) { const page: GraphPage<T> = await this.request(next, operation, list); items.push(...page.value); next = page["@odata.nextLink"]; } return items; }
  private async request<T>(pathOrUrl: string, operation: string, list?: string): Promise<T> {
    const token = await this.tokens.getAccessToken(); const url = pathOrUrl.startsWith("http") ? pathOrUrl : `https://graph.microsoft.com/v1.0${pathOrUrl}`;
    for (let attempt = 0; attempt < 3; attempt++) { const started = Date.now(); let response: Response; try { response = await this.fetcher(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(this.timeoutMs) }); } catch { throw new AppError("EXTERNAL_SERVICE_ERROR", "SharePoint request timed out or failed."); }
      this.log({ operation, list, status: response.status, duration: Date.now() - started }); if (response.ok) return response.json() as Promise<T>;
      if (![429, 502, 503, 504].includes(response.status) || attempt === 2) throw new AppError(response.status === 401 ? "UNAUTHORIZED" : response.status === 403 ? "FORBIDDEN" : response.status === 404 ? "NOT_FOUND" : "EXTERNAL_SERVICE_ERROR", "SharePoint request failed.", [401, 403, 404].includes(response.status) ? response.status : 502);
      const retryAfter = Number(response.headers.get("retry-after") ?? 0); await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 100 * (attempt + 1)));
    } throw new AppError("EXTERNAL_SERVICE_ERROR", "SharePoint request failed.");
  }
}
