import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import type { AuthProvider,AuthenticatedPrincipal } from "../src/auth/auth-provider.js";
import { SupabaseAuthProvider } from "../src/auth/auth-provider.js";
import { AppError } from "../src/lib/errors.js";
import { MockSharePointRepository } from "../src/repositories/mock-repository.js";
import { AuthService,requireAdmin,requireAuthenticated,requireCustomer,requireStaffOrAdmin } from "../src/services/auth-service.js";
import { CatalogService } from "../src/services/catalog-service.js";
import { ReservationService } from "../src/services/reservation-service.js";

const request=(headers:Record<string,string>={})=>({method:"GET",url:"/api/test",headers});
const principal=(email:string,extra:Record<string,unknown>={}):AuthenticatedPrincipal=>({subject:`subject:${email}`,email,...extra});
const provider=(value:AuthenticatedPrincipal|null|Error):AuthProvider=>({authenticate:vi.fn(async()=>{if(value instanceof Error)throw value;return value;})});
let repo:MockSharePointRepository;

beforeEach(()=>{repo=new MockSharePointRepository(); process.env.NODE_ENV="test"; delete process.env.VERCEL_ENV; delete process.env.ENABLE_DEV_AUTH; delete process.env.DEV_AUTH_EMAIL;});
afterEach(()=>{delete process.env.VERCEL_ENV; delete process.env.ENABLE_DEV_AUTH; delete process.env.DEV_AUTH_EMAIL; process.env.NODE_ENV="test";});

describe("production authentication boundary",()=>{
  it.each([["customer@example.test","Customer"],["staff@example.test","Staff"],["admin@example.test","Admin"]])("authenticates a registered %s as SQL %s",async(email,role)=>{const user=await requireAuthenticated(new AuthService(repo,provider(principal(email))),request()); expect(user).toMatchObject({email,role});});
  it("returns no user when no identity is supplied",async()=>{await expect(new AuthService(repo,provider(null)).getCurrentUser(request())).resolves.toBeNull();});
  it("returns a pending identity for its status screen but blocks protected access",async()=>{repo.users[0]!.approvalStatus="pending";const auth=new AuthService(repo,provider(principal("customer@example.test")));await expect(auth.getSessionUser(request())).resolves.toMatchObject({approvalStatus:"pending"});await expect(requireCustomer(auth,request())).rejects.toMatchObject({code:"FORBIDDEN"});});
  it("rejects an inactive SQL user",async()=>{repo.users[0]!.isActive=false; await expect(requireAuthenticated(new AuthService(repo,provider(principal("customer@example.test"))),request())).rejects.toMatchObject({code:"INACTIVE_USER"});});
  it.each(["pending","rejected"] as const)("blocks %s accounts from direct API access",async approvalStatus=>{repo.users[0]!.approvalStatus=approvalStatus;await expect(requireCustomer(new AuthService(repo,provider(principal("customer@example.test"))),request())).rejects.toMatchObject({code:"FORBIDDEN"});});
  it("invalidates a suspended account on its next request",async()=>{repo.users[0]!.approvalStatus="suspended";await expect(requireAuthenticated(new AuthService(repo,provider(principal("customer@example.test"))),request())).rejects.toMatchObject({code:"INACTIVE_USER"});});
  it("rejects an authenticated identity absent from SQL",async()=>{await expect(requireAuthenticated(new AuthService(repo,provider(principal("unknown@example.test"))),request())).rejects.toMatchObject({code:"FORBIDDEN"});});
  it("denies Customer access to Staff operations",async()=>{await expect(requireStaffOrAdmin(new AuthService(repo,provider(principal("customer@example.test"))),request())).rejects.toMatchObject({code:"FORBIDDEN"});});
  it("denies Customer access to Admin operations",async()=>{await expect(requireAdmin(new AuthService(repo,provider(principal("customer@example.test"))),request())).rejects.toMatchObject({code:"FORBIDDEN"});});
  it("denies Staff access to Admin operations",async()=>{await expect(requireAdmin(new AuthService(repo,provider(principal("staff@example.test"))),request())).rejects.toMatchObject({code:"FORBIDDEN"});});
  it("allows Admin access to Admin operations",async()=>{await expect(requireAdmin(new AuthService(repo,provider(principal("admin@example.test"))),request())).resolves.toMatchObject({role:"Admin"});});
  it("denies cross-customer reservation access",async()=>{repo.users.push({id:"user-4",email:"other@example.test",displayName:"Other",role:"Customer",isActive:true}); const other=await requireCustomer(new AuthService(repo,provider(principal("other@example.test"))),request()); await expect(new ReservationService(repo,new CatalogService(repo)).get("res-1",other)).rejects.toMatchObject({code:"NOT_FOUND"});});
  it("denies cross-customer notification mutation",async()=>{await expect(repo.markNotificationRead("note-1","other@example.test")).resolves.toBe(false); expect(repo.notifications[0]!.isRead).toBe(false);});
  it("rejects invalid or expired credentials from the provider",async()=>{await expect(requireAuthenticated(new AuthService(repo,provider(new AppError("UNAUTHORIZED","Invalid or expired authentication token."))),request())).rejects.toMatchObject({code:"UNAUTHORIZED"});});
  it("rejects malformed bearer credentials before network access",async()=>{await expect(new SupabaseAuthProvider().authenticate(request({authorization:"Basic nope"}))).rejects.toMatchObject({code:"UNAUTHORIZED"});});
  it("rejects development authentication in production",async()=>{process.env.NODE_ENV="production";process.env.ENABLE_DEV_AUTH="true"; await expect(new AuthService(repo,provider(null)).getCurrentUser(request({"x-dev-user":"admin@example.test"}))).rejects.toMatchObject({code:"CONFIGURATION_ERROR"});});
  it("uses the SQL role instead of untrusted provider role metadata",async()=>{const identity=principal("customer@example.test",{role:"Admin"}) as AuthenticatedPrincipal; const user=await requireAuthenticated(new AuthService(repo,provider(identity)),request()); expect(user.role).toBe("Customer");});
  it("normalizes authenticated email before SQL lookup",async()=>{const user=await requireAuthenticated(new AuthService(repo,provider(principal("  CUSTOMER@EXAMPLE.TEST  "))),request()); expect(user.role).toBe("Customer");});
});
