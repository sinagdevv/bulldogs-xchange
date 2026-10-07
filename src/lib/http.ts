import { AppError } from "./errors.js";

export interface RequestLike { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body?: unknown; query?: Record<string, string | string[] | undefined> }
export interface ResponseLike { status(code: number): ResponseLike; json(value: unknown): void; setHeader(name: string, value: string): void; end?(): void }

export const ok = (data: unknown, message = "OK", reference: string | null = null) => ({ success: true as const, data, reference, message });
export const fail = (code: string, message: string) => ({ success: false as const, error: { code, message } });

export function sendError(res: ResponseLike, error: unknown): void {
  const appError = error instanceof AppError ? error : new AppError("EXTERNAL_SERVICE_ERROR", "An unexpected error occurred.", 500);
  res.status(appError.status).json(fail(appError.code, appError.message));
}

export function secure(res: ResponseLike): void {
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
}

export function cors(req:RequestLike,res:ResponseLike):void{
  const value=req.headers.origin,origin=Array.isArray(value)?value[0]:value;
  if(!origin)return;
  const allowed=process.env.FRONTEND_ORIGIN;
  if(!allowed||origin!==allowed)throw new AppError("FORBIDDEN","Origin is not allowed.");
  res.setHeader("Access-Control-Allow-Origin",allowed);
  res.setHeader("Access-Control-Allow-Methods","GET,POST,PUT,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Authorization,Content-Type,Idempotency-Key");
  res.setHeader("Vary","Origin");
}
