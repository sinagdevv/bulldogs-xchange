import { AppError } from "../lib/errors.js";
export interface TokenProvider { getAccessToken(): Promise<string> }
export class MicrosoftTokenProvider implements TokenProvider {
  private cached?: { token: string; expiresAt: number };
  constructor(private fetcher: typeof fetch = fetch) {}
  async getAccessToken(): Promise<string> {
    if (this.cached && this.cached.expiresAt > Date.now() + 60_000) return this.cached.token;
    const tenant = process.env.SHAREPOINT_TENANT_ID, clientId = process.env.SHAREPOINT_CLIENT_ID, secret = process.env.SHAREPOINT_CLIENT_SECRET;
    if (!tenant || !clientId || !secret) throw new AppError("CONFIGURATION_ERROR", "SharePoint authentication is not configured.");
    let response: Response;
    try { response = await this.fetcher(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: secret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }), signal: AbortSignal.timeout(8000) }); }
    catch { throw new AppError("EXTERNAL_SERVICE_ERROR", "Microsoft authentication request failed."); }
    if (!response.ok) throw new AppError([400, 401, 403].includes(response.status) ? "CONFIGURATION_ERROR" : "EXTERNAL_SERVICE_ERROR", "Microsoft authentication failed.");
    const data = await response.json() as { access_token?: string; expires_in?: number }; if (!data.access_token) throw new AppError("EXTERNAL_SERVICE_ERROR", "Microsoft authentication returned no access token.");
    this.cached = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 }; return data.access_token;
  }
}
