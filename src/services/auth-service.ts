import type { Role, User } from "../domain/models.js";
import { AppError } from "../lib/errors.js";
import type { RequestLike } from "../lib/http.js";
import type { SharePointRepository } from "../repositories/repository.js";
import { OidcAuthProvider, type AuthProvider } from "../auth/auth-provider.js";

export class AuthService {
  constructor(private repo: SharePointRepository,private provider:AuthProvider=new OidcAuthProvider()) {}

  async getCurrentUser(req: RequestLike): Promise<User | null> {
    const production=process.env.VERCEL_ENV==="production"||process.env.NODE_ENV==="production";
    if(production&&process.env.ENABLE_DEV_AUTH==="true")throw new AppError("CONFIGURATION_ERROR","Development authentication is disabled in production.");
    let email:string|undefined;
    if(!production&&process.env.ENABLE_DEV_AUTH==="true")email=String(req.headers["x-dev-user"]??process.env.DEV_AUTH_EMAIL??"").trim().toLowerCase()||undefined;
    else email=(await this.provider.authenticate(req))?.email.trim().toLowerCase();
    if(!email)return null;
    const user=await this.repo.getUserByEmail(email);
    if(!user)throw new AppError("FORBIDDEN","Authenticated identity is not registered.");
    if(!user.isActive)throw new AppError("INACTIVE_USER","User account is inactive.");
    return user;
  }

  async getIdentity(req:RequestLike){
    const production=process.env.VERCEL_ENV==="production"||process.env.NODE_ENV==="production";
    if(production&&process.env.ENABLE_DEV_AUTH==="true")throw new AppError("CONFIGURATION_ERROR","Development authentication is disabled in production.");
    const devEmail=!production&&process.env.ENABLE_DEV_AUTH==="true"?String(req.headers["x-dev-user"]??process.env.DEV_AUTH_EMAIL??"").trim().toLowerCase():"";
    const identity=devEmail?{subject:`development:${devEmail}`,email:devEmail}:await this.provider.authenticate(req);
    if(!identity)throw new AppError("UNAUTHORIZED","Authentication required.");
    return identity;
  }

  async getRegisteredUser(req:RequestLike){
    const identity=await this.getIdentity(req),user=await this.repo.getUserByEmail(identity.email);
    if(user&&!user.isActive)throw new AppError("INACTIVE_USER","User account is inactive.");
    return{identity,user};
  }

  async requireUser(req: RequestLike): Promise<User> {
    const user = await this.getCurrentUser(req);
    if (!user) throw new AppError("UNAUTHORIZED", "Authentication required.");
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
