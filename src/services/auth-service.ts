import type { Role, User } from "../domain/models.js";
import { AppError } from "../lib/errors.js";
import type { RequestLike } from "../lib/http.js";
import type { SharePointRepository } from "../repositories/repository.js";
import { SupabaseAuthProvider, type AuthProvider } from "../auth/auth-provider.js";

export class AuthService {
  constructor(private repo: SharePointRepository,private provider:AuthProvider=new SupabaseAuthProvider()) {}

  async getCurrentUser(req: RequestLike): Promise<User | null> {
    const user=await this.getSessionUser(req);
    if(user)this.ensureApproved(user);
    return user;
  }

  async getSessionUser(req: RequestLike): Promise<User | null> {
    const production=process.env.VERCEL_ENV==="production"||process.env.NODE_ENV==="production";
    if(production&&process.env.ENABLE_DEV_AUTH==="true")throw new AppError("CONFIGURATION_ERROR","Development authentication is disabled in production.");
    const devEmail=!production&&process.env.LOCAL_DEMO!=="true"&&process.env.ENABLE_DEV_AUTH==="true"?String(req.headers["x-dev-user"]??process.env.DEV_AUTH_EMAIL??"").trim().toLowerCase():"";
    const principal=devEmail?{subject:`development:${devEmail}`,email:devEmail}:await this.provider.authenticate(req);
    if(!principal)return null;
    const user=devEmail||principal.subject.startsWith("local:")?await this.repo.getUserByEmail(principal.email.trim().toLowerCase()):await this.repo.getUserByAuthSubject(principal.subject)??await this.repo.getUserByEmail(principal.email.trim().toLowerCase());
    if(!user)throw new AppError("FORBIDDEN","Authenticated identity is not registered.");
    return user;
  }

  async getIdentity(req:RequestLike){
    const production=process.env.VERCEL_ENV==="production"||process.env.NODE_ENV==="production";
    if(production&&process.env.ENABLE_DEV_AUTH==="true")throw new AppError("CONFIGURATION_ERROR","Development authentication is disabled in production.");
    const devEmail=!production&&process.env.LOCAL_DEMO!=="true"&&process.env.ENABLE_DEV_AUTH==="true"?String(req.headers["x-dev-user"]??process.env.DEV_AUTH_EMAIL??"").trim().toLowerCase():"";
    const identity=devEmail?{subject:`development:${devEmail}`,email:devEmail}:await this.provider.authenticate(req);
    if(!identity)throw new AppError("UNAUTHORIZED","Authentication required.");
    return identity;
  }

  async getRegisteredUser(req:RequestLike){
    const production=process.env.VERCEL_ENV==="production"||process.env.NODE_ENV==="production",identity=await this.getIdentity(req),devEmail=!production&&process.env.ENABLE_DEV_AUTH==="true"?String(req.headers["x-dev-user"]??process.env.DEV_AUTH_EMAIL??"").trim().toLowerCase():"",user=devEmail||identity.subject.startsWith("local:")?await this.repo.getUserByEmail(identity.email):await this.repo.getUserByAuthSubject(identity.subject)??await this.repo.getUserByEmail(identity.email);
    if(user)this.ensureApproved(user);
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
  private ensureApproved(user:User){if(!user.isActive||user.approvalStatus==="suspended")throw new AppError("INACTIVE_USER","User account is suspended.");if(user.approvalStatus==="pending")throw new AppError("FORBIDDEN","Account is pending Admin approval.");if(user.approvalStatus==="rejected")throw new AppError("FORBIDDEN",user.rejectionReason?`Account was rejected: ${user.rejectionReason}`:"Account registration was rejected.");}
}

export const requireAuthenticated = (auth: AuthService, req: RequestLike) => auth.requireUser(req);
export const requireCustomer = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Customer"]);
export const requireStaff = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Staff"]);
export const requireAdmin = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Admin"]);
export const requireStaffOrAdmin = (auth: AuthService, req: RequestLike) => auth.requireRole(req, ["Staff", "Admin"]);
