import type { Role, User } from "../domain/models.js";
import { AppError } from "../lib/errors.js";
import type { RequestLike } from "../lib/http.js";
import type { SharePointRepository } from "../repositories/repository.js";

export class AuthService {
  constructor(private repo: SharePointRepository) {}

  async getCurrentUser(req: RequestLike): Promise<User | null> {
    if (process.env.ENABLE_DEV_AUTH !== "true") return null;
    if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") throw new AppError("CONFIGURATION_ERROR", "Development authentication is disabled in production.");
    const email = String(req.headers["x-dev-user"] ?? process.env.DEV_AUTH_EMAIL ?? "").toLowerCase();
    return await this.repo.getUserByEmail(email) ?? null;
  }

  async requireUser(req: RequestLike): Promise<User> {
    const user = await this.getCurrentUser(req);
    if (!user) throw new AppError("UNAUTHORIZED", "Authentication required.");
    if (!user.isActive) throw new AppError("INACTIVE_USER", "User account is inactive.");
    return user;
  }

  async requireRole(req: RequestLike, roles: Role[]): Promise<User> {
    const user = await this.requireUser(req);
    if (!roles.includes(user.role)) throw new AppError("FORBIDDEN", "Insufficient permissions.");
    return user;
  }
}

export const requireAuthenticated = (auth: AuthService, req: RequestLike) => auth.requireUser(req);
export const requireCustomer = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Customer"]);
export const requireStaff = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Staff"]);
export const requireAdmin = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Admin"]);
export const requireStaffOrAdmin = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Staff", "Admin"]);
