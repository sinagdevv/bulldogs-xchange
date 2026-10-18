import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "./lib/errors.js";
import { cors, ok, secure, sendError, type RequestLike, type ResponseLike } from "./lib/http.js";
import { createRepository } from "./repositories/provider.js";
import { ProductionSharePointRepository } from "./repositories/production-sharepoint-repository.js";
import { SqlServerRepository } from "./repositories/sql-server-repository.js";
import type { SqlTransactionManager } from "./integrations/sql-server.js";
import { AnalyticsService } from "./services/analytics-service.js";
import { AuthService, requireAdmin, requireAuthenticated, requireCustomer, requireStaffOrAdmin } from "./services/auth-service.js";
import { CatalogService } from "./services/catalog-service.js";
import { QueueService } from "./services/queue-service.js";
import { ReservationService } from "./services/reservation-service.js";
import { SqlBusinessService } from "./services/sql-business-service.js";
import { SqlAdminService } from "./services/sql-admin-service.js";
import { OutboxDispatcher } from "./services/outbox-dispatcher.js";
import { UserProvisioningService } from "./services/user-provisioning-service.js";
import { StudentAuthService } from "./services/student-auth-service.js";
import {SqlReportingService,toCsv} from "./services/sql-reporting-service.js";
import {DepositService} from "./services/deposit-service.js";
import {ReservationExpirationService} from "./services/reservation-expiration-service.js";
import {AuthRateLimiter,createAuthRateLimitStore} from "./services/auth-rate-limiter.js";
import {requireFinancialCapability,type FinancialCapability} from "./services/financial-access.js";
import {FinancialReportingService} from "./services/financial-reporting-service.js";
import {toPdf,toXlsx,type ReportType} from "./services/report-export-service.js";
import {PaymentEvidenceService} from "./services/payment-evidence-service.js";
import {LocalAuth,LocalAuthProvider} from "./auth/local-demo-auth.js";
import {BarkyService,canAccessBarkySession} from "./services/barky-service.js";

export const repository = createRepository();
const localDemo=process.env.LOCAL_DEMO==="true"&&process.env.DATA_PROVIDER==="postgres"&&process.env.SUPABASE_DATABASE_URL?.includes("127.0.0.1:55432/bulldogs_xchange_staging");
const auth = new AuthService(repository,localDemo?new LocalAuthProvider():undefined), catalog = new CatalogService(repository), reservations = new ReservationService(repository, catalog), queue = new QueueService(repository), analytics = new AnalyticsService(repository);
const sql = repository instanceof SqlServerRepository && "transaction" in repository.db ? repository.db as SqlTransactionManager : null;
const sqlBusiness = sql ? new SqlBusinessService(sql) : null;
const sqlAdmin = sql ? new SqlAdminService(sql) : null;
const outbox = sql ? new OutboxDispatcher(sql) : null;
const provisioning=sql?new UserProvisioningService(sql):null;
const studentAuth=sql?(localDemo?new LocalAuth(sql):new StudentAuthService(sql)):null;
const reporting=sql?new SqlReportingService(sql):null;
const deposits=sql?new DepositService(sql):null,expiration=sql?new ReservationExpirationService(sql):null;
const paymentEvidence=sql?new PaymentEvidenceService(sql):null;
const financialReporting=sql?new FinancialReportingService(sql):null;
const authRateLimiter=new AuthRateLimiter(createAuthRateLimitStore(sql??undefined));
const barky=sql?new BarkyService(sql):null;
const bool = (value: unknown) => value === undefined ? undefined : String(value) === "true";
const notificationId = z.string().trim().min(1).max(100);
const financeId=(value:string|undefined)=>{const parsed=z.coerce.number().int().positive().safeParse(value);if(!parsed.success)throw new AppError("VALIDATION_ERROR","Invalid financial record id.");return parsed.data};
const requireDepositFeature=()=>{if(process.env.ENABLE_DEPOSIT_WORKFLOW!=="true")throw new AppError("FORBIDDEN","Refundable deposits are not enabled.");if(!deposits||!expiration||!paymentEvidence)throw new AppError("CONFIGURATION_ERROR","Deposit services are unavailable.");};
const financialActor=async(req:RequestLike,capability:FinancialCapability)=>requireFinancialCapability(await requireStaffOrAdmin(auth,req),capability);
const pathOf = (req: RequestLike) => new URL(req.url ?? "/", "http://localhost").pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
const requireDispatchSecret=(req:RequestLike,cron=false)=>{const expected=cron?process.env.CRON_SECRET:process.env.OUTBOX_DISPATCH_SECRET,provided=String(req.headers.authorization??"").replace(/^Bearer\s+/i,""); if(!expected||!provided||Buffer.byteLength(expected)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided))) throw new AppError("UNAUTHORIZED","Invalid internal authorization.");};
const adminCatalogResources=["products","categories","variants"];
const knownAdminMutation=(method:string,parts:string[])=>method==="POST"&&adminCatalogResources.includes(parts[1]??"")&&parts.length===2||method==="PUT"&&((adminCatalogResources.includes(parts[1]??"")&&(parts.length===3||parts[3]==="active"&&parts.length===4))||(parts[1]==="users"&&["role","approval"].includes(parts[3]??"")&&parts.length===4)||(parts[1]==="settings"&&parts.length===3));
const header=(value:string|string[]|undefined)=>Array.isArray(value)?value[0]:value;
const refreshToken=(req:RequestLike)=>header(req.headers.cookie)?.split(";").map(value=>value.trim()).find(value=>value.startsWith("bx_refresh="))?.slice("bx_refresh=".length);
export const refreshCookie=(value:string,maxAge=60*60*24*30)=>`bx_refresh=${encodeURIComponent(value)}; Path=/api/auth; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV==="production"||["preview","production"].includes(process.env.VERCEL_ENV??"")?"; Secure":""}`;
const accessToken=(req:RequestLike)=>/^Bearer\s+(\S+)$/i.exec(header(req.headers.authorization)??"")?.[1];

export async function handle(req: RequestLike, res: ResponseLike): Promise<void> {
  const suppliedRequestId=String(req.headers["x-request-id"]??"");
  const requestId=/^[A-Za-z0-9._-]{1,100}$/.test(suppliedRequestId)?suppliedRequestId:randomUUID();
  res.setHeader("X-Request-ID",requestId);
  secure(res);
  try {
    cors(req,res); if (req.method === "OPTIONS") { res.setHeader("Allow", "GET,POST,PUT,OPTIONS"); res.status(204).end?.(); return; }
    const method = req.method ?? "GET", parts = pathOf(req), route = parts.join("/"), id = parts[1];
    if (method === "GET" && route === "health") return void res.status(200).json(ok({ status: "healthy", service: "bulldogs-xchange" }));
    if(route.startsWith("internal/outbox/")&&!outbox) throw new AppError("CONFIGURATION_ERROR","SQL outbox is unavailable.");
    if(route.startsWith("internal/outbox/")){requireDispatchSecret(req,route==="internal/outbox/dispatch"&&method==="GET"); if(route==="internal/outbox/dispatch"&&(method==="GET"||method==="POST")) return void res.status(200).json(ok(await outbox!.dispatchBatch())); if(route==="internal/outbox/health"&&method==="GET") return void res.status(200).json(ok(await outbox!.health())); if(route==="internal/outbox/dead-letters"&&method==="GET") return void res.status(200).json(ok(await outbox!.deadLetters())); if(parts[2]==="dead-letters"&&parts[3]&&parts[4]==="retry"&&method==="POST") return void res.status(200).json(ok(await outbox!.retryDeadLetter(parts[3])));}
    if(route==="internal/reservations/expire"&&(method==="GET"||method==="POST")){requireDispatchSecret(req,method==="GET");requireDepositFeature();return void res.status(200).json(ok(await expiration!.run()));}
    if (method === "GET" && route === "internal/integrations/sharepoint") { if (process.env.NODE_ENV === "production") await requireAdmin(auth, req); if (!(repository instanceof ProductionSharePointRepository)) return void res.status(200).json(ok({ configured: false, reachable: false, site: null, listsResolved: 0 })); return void res.status(200).json(ok(await repository.health())); }
    if (method === "GET" && route === "config/public") return void res.status(200).json(ok({ campusPickupOnly: true }));
if(method==="POST"&&route==="auth/register")throw new AppError("FORBIDDEN","Accounts are provisioned by an authorized Bulldogs Xchange operator.");
    if(method==="POST"&&route==="auth/resend-verification"){if(!studentAuth)throw new AppError("CONFIGURATION_ERROR","Student authentication is unavailable.");await authRateLimiter.check(req);await studentAuth.resendVerification(req.body);return void res.status(202).json(ok({accepted:true},"If the account is eligible, a verification email will be sent."));}
    if(method==="POST"&&route==="auth/otp"){if(!(studentAuth instanceof StudentAuthService))throw new AppError("FORBIDDEN","Email OTP authentication is unavailable.");await authRateLimiter.check(req);await studentAuth.requestOtp(req.body);return void res.status(202).json(ok({accepted:true},"If the account is eligible, a verification code will be sent."));}
    if(method==="POST"&&route==="auth/otp/verify"){if(!(studentAuth instanceof StudentAuthService))throw new AppError("FORBIDDEN","Email OTP authentication is unavailable.");await authRateLimiter.check(req);const{refreshToken,...data}=await studentAuth.verifyOtp(req.body);res.setHeader("Set-Cookie",refreshCookie(refreshToken));return void res.status(200).json(ok(data));}
if(method==="POST"&&route==="auth/recovery"){if(!studentAuth)throw new AppError("CONFIGURATION_ERROR","Student authentication is unavailable.");await authRateLimiter.check(req);return void res.status(202).json(ok(await studentAuth.requestPasswordReset(req.body)));}
    if(method==="POST"&&route==="auth/recovery/verify"){if(!(studentAuth instanceof StudentAuthService))throw new AppError("FORBIDDEN","Password recovery is unavailable.");await authRateLimiter.check(req);return void res.status(200).json(ok(await studentAuth.exchangeRecoveryToken(req.body)));}
    if(method==="POST"&&route==="auth/recovery-session"){if(!(studentAuth instanceof StudentAuthService))throw new AppError("FORBIDDEN","Password recovery is unavailable.");await authRateLimiter.check(req);const token=accessToken(req);if(!token)throw new AppError("UNAUTHORIZED","A valid recovery session is required.");return void res.status(200).json(ok(await studentAuth.validateRecovery(token)));}
    if(method==="PUT"&&route==="auth/password"){if(!studentAuth)throw new AppError("CONFIGURATION_ERROR","Student authentication is unavailable.");await authRateLimiter.check(req);const token=accessToken(req);if(!token)throw new AppError("UNAUTHORIZED","A valid recovery session is required.");return void res.status(200).json(ok(await studentAuth.updatePassword(req.body,token)));}
    if(method==="POST"&&route==="auth/login"){if(!studentAuth)throw new AppError("CONFIGURATION_ERROR","Student authentication is unavailable.");await authRateLimiter.check(req);const{refreshToken,...data}=await studentAuth.login(req.body);res.setHeader("Set-Cookie",refreshCookie(refreshToken));return void res.status(200).json(ok(data));}
    if(method==="POST"&&route==="auth/refresh"){if(!studentAuth)throw new AppError("CONFIGURATION_ERROR","Student authentication is unavailable.");const current=refreshToken(req);if(!current)throw new AppError("UNAUTHORIZED","Session expired. Please log in again.");try{const{refreshToken:next,...data}=await studentAuth.refresh(decodeURIComponent(current));await auth.getSessionUser({...req,headers:{...req.headers,authorization:`Bearer ${data.accessToken}`}});res.setHeader("Set-Cookie",refreshCookie(next));return void res.status(200).json(ok(data));}catch(error){res.setHeader("Set-Cookie",refreshCookie("",0));throw error;}}
    if(method==="POST"&&route==="auth/logout"){if(!studentAuth)throw new AppError("CONFIGURATION_ERROR","Student authentication is unavailable.");let token=accessToken(req);res.setHeader("Set-Cookie",refreshCookie("",0));if(!token){const current=refreshToken(req);if(current)token=(await studentAuth.refresh(decodeURIComponent(current))).accessToken;}if(token)await studentAuth.logout(token);return void res.status(200).json(ok({loggedOut:true}));}
    if (method === "GET" && route === "session") { const user=await auth.getSessionUser(req).catch(e=>{if(e instanceof AppError&&e.code==="UNAUTHORIZED")return null;throw e});return void res.status(200).json(ok(user?{authenticated:true,user,onboardingRequired:false}:{authenticated:false,user:null})); }
    if(method==="POST"&&route==="onboarding/customer"){if(!provisioning)throw new AppError("CONFIGURATION_ERROR","SQL account provisioning is unavailable.");const identity=await auth.getIdentity(req);return void res.status(201).json(ok(await provisioning.registerCustomer(identity,req.body),"Customer account created."));}
    if (method === "GET" && route === "me") return void res.status(200).json(ok(await requireAuthenticated(auth, req)));
    if (method === "GET" && route === "categories") return void res.status(200).json(ok(await catalog.getCategories()));
    if (method === "GET" && route === "products") return void res.status(200).json(ok(await catalog.getProducts({ search: String(req.query?.search ?? "") || undefined, category: String(req.query?.category ?? "") || undefined, featured: bool(req.query?.featured), active: bool(req.query?.active), sort: req.query?.sort as "title" | "price" | "-price" | undefined })));
    if (method === "GET" && parts[0] === "products" && id && parts.length === 2) return void res.status(200).json(ok(await catalog.getProduct(id)));
    if (method === "GET" && parts[0] === "products" && id && parts[2] === "variants") return void res.status(200).json(ok(await catalog.getVariants(id)));
    if (method === "GET" && parts[0] === "products" && id && parts[2] === "availability") return void res.status(200).json(ok(await catalog.getAvailability(id)));
    if (route === "reservations" && method === "GET") return void res.status(200).json(ok(await reservations.list(await requireAuthenticated(auth, req))));
    if (route === "reservations" && method === "POST") { if (JSON.stringify(req.body ?? null).length > 32768) throw new AppError("VALIDATION_ERROR","Request body is too large.",413); const user=await requireCustomer(auth,req); const item = sqlBusiness ? await sqlBusiness.createReservation(req.body,user,req.headers["idempotency-key"]) : await reservations.create(req.body,user); return void res.status(201).json(ok(item, "Reservation created successfully.", item.reference)); }
    if (parts[0] === "reservations" && id && parts.length === 2 && method === "GET") return void res.status(200).json(ok(await reservations.get(id, await requireAuthenticated(auth, req))));
    if (parts[0] === "reservations" && id && parts[2] === "cancel" && method === "POST") { const user=await requireAuthenticated(auth,req); return void res.status(200).json(ok(sqlBusiness ? await sqlBusiness.cancelReservation(id,user) : await reservations.cancel(id,user), "Reservation cancelled.")); }
    if (route === "queue/me" && method === "GET") return void res.status(200).json(ok(await queue.mine(await requireCustomer(auth, req))));
    if (route === "queue/status" && method === "GET") return void res.status(200).json(ok(await queue.status()));
    if (route === "queue/join" && method === "POST") { const user=await requireCustomer(auth,req); return void res.status(201).json(ok(sqlBusiness ? await sqlBusiness.joinQueue(req.body,user) : await queue.join(req.body,user), "Joined pickup queue.")); }
    if (route === "queue/leave" && method === "POST") { const user=await requireCustomer(auth,req); return void res.status(200).json(ok(sqlBusiness?await sqlBusiness.leaveQueue(user):await queue.leave(user), "Left pickup queue.")); }
    if (route === "notifications" && method === "GET") { const user = await requireAuthenticated(auth, req); return void res.status(200).json(ok(await repository.getNotifications(user.email))); }
    if (route === "notifications/unread-count" && method === "GET") { const user=await requireAuthenticated(auth,req),items=await repository.getNotifications(user.email); return void res.status(200).json(ok({count:items.filter(item=>!item.isRead).length})); }
    if (parts[0] === "notifications" && id && parts[2] === "read" && parts.length===3 && method === "POST") { const user = await requireAuthenticated(auth, req),parsed=notificationId.safeParse(id); if(!parsed.success) throw new AppError("VALIDATION_ERROR","Invalid notification id."); if(!await repository.markNotificationRead(parsed.data,user.email)) throw new AppError("NOT_FOUND","Notification not found."); return void res.status(200).json(ok({id:parsed.data,isRead:true})); }
    if (route === "notifications/read-all" && method === "POST") { const user = await requireAuthenticated(auth, req); return void res.status(200).json(ok({updated:await repository.markAllNotificationsRead(user.email)}, "Notifications marked read.")); }
    if (route === "profile" && method === "GET") return void res.status(200).json(ok(await requireAuthenticated(auth, req)));
    if(parts[0]==="customer"&&parts[1]==="reservations"&&parts[2]&&parts[3]==="deposit"){requireDepositFeature();const user=await requireCustomer(auth,req),reservationId=financeId(parts[2]);if(parts.length===4&&method==="GET")return void res.status(200).json(ok(await deposits!.get(reservationId,user)));if(parts[4]==="evidence"&&parts.length===5&&method==="POST")return void res.status(201).json(ok(await paymentEvidence!.upload(reservationId,req.body,user)));if(parts[4]==="submission"&&parts.length===5&&method==="POST")return void res.status(200).json(ok(await deposits!.submit(reservationId,req.body,user)));}
    if(route==="staff/deposits"&&method==="GET"){requireDepositFeature();await requireStaffOrAdmin(auth,req);return void res.status(200).json(ok(await deposits!.listDeposits()));}
    if(parts[0]==="staff"&&parts[1]==="deposits"&&parts[2]&&parts[3]==="evidence"&&parts.length===4&&method==="GET"){requireDepositFeature();return void res.status(200).json(ok(await paymentEvidence!.review(financeId(parts[2]),await requireStaffOrAdmin(auth,req))));}
    if(route==="admin/refunds"&&method==="GET"){requireDepositFeature();await requireAdmin(auth,req);return void res.status(200).json(ok(await deposits!.listRefunds()));}
    if(route==="staff/refunds"&&method==="GET"){requireDepositFeature();return void res.status(200).json(ok(await deposits!.listAssignedRefunds(await financialActor(req,"refund.view_assigned"))));}
    if(parts[0]==="admin"&&parts[1]==="finance"&&parts[2]?.endsWith(".csv")&&method==="GET"){requireDepositFeature();await requireAdmin(auth,req);if(!financialReporting)throw new AppError("CONFIGURATION_ERROR","Financial reporting is unavailable.");const key=parts[2].slice(0,-4),page=key==="transactions"?await financialReporting.transactions(req.query):key==="refunds"?await financialReporting.refunds(req.query):key==="reconciliation"?await financialReporting.reconciliation(req.query):key==="operators"?await financialReporting.operatorActivity(req.query):null;if(!page)throw new AppError("NOT_FOUND","Financial export not found.");res.setHeader("Content-Type","text/csv; charset=utf-8");res.setHeader("Content-Disposition",`attachment; filename="bulldogs-xchange-finance-${key}.csv"`);return void res.status(200).end?.(`\uFEFF${toCsv(page.items)}`);}
    if(parts[0]==="admin"&&parts[1]==="finance"&&parts[2]&&method==="GET"){requireDepositFeature();await requireAdmin(auth,req);if(!financialReporting)throw new AppError("CONFIGURATION_ERROR","Financial reporting is unavailable.");const key=parts[2],data=key==="overview"?await financialReporting.overview(req.query):key==="transactions"?await financialReporting.transactions(req.query):key==="refunds"?await financialReporting.refunds(req.query):key==="reconciliation"?await financialReporting.reconciliation(req.query):key==="operators"?await financialReporting.operatorActivity(req.query):null;if(data===null)throw new AppError("NOT_FOUND","Financial report not found.");return void res.status(200).json(ok(data));}
    if(parts[0]==="staff"&&parts[1]==="deposits"&&parts[2]&&parts[3]==="cash"&&parts.length===4&&method==="POST"){requireDepositFeature();return void res.status(200).json(ok(await deposits!.collectCash(financeId(parts[2]),req.body,await financialActor(req,"cash.collect"))));}
    if(parts[0]==="staff"&&parts[1]==="deposits"&&parts[2]&&parts.length===4&&method==="POST"){requireDepositFeature();const actor=await requireStaffOrAdmin(auth,req),approve=parts[3]==="verify";if(!approve&&parts[3]!=="reject")throw new AppError("NOT_FOUND","Route not found.");return void res.status(200).json(ok(await deposits!.decide(financeId(parts[2]),approve,req.body,actor)));}
    if(["admin","staff"].includes(parts[0]??"")&&parts[1]==="refunds"&&parts[2]&&parts[3]==="decision"&&parts.length===4&&method==="POST"){requireDepositFeature();return void res.status(200).json(ok(await deposits!.decideRefund(financeId(parts[2]),req.body,await financialActor(req,parts[0]==="admin"?"refund.approve_exception":"refund.approve_routine"))));}
    if(parts[0]==="staff"&&parts[1]==="refunds"&&parts[2]&&parts[3]==="payout"&&parts.length===4&&method==="POST"){requireDepositFeature();return void res.status(200).json(ok(await deposits!.recordRefundPayout(financeId(parts[2]),req.body,await requireStaffOrAdmin(auth,req))));}
    if(["admin","staff"].includes(parts[0]??"")&&parts[1]==="refunds"&&parts[2]&&parts[3]==="confirm"&&parts.length===4&&method==="POST"){requireDepositFeature();return void res.status(200).json(ok(await deposits!.completeRefund(financeId(parts[2]),await financialActor(req,"refund.confirm_independent"))));}
    if (sqlBusiness && parts[0]==="staff" && parts[1]==="reservations" && parts[2] && method==="POST") { const actor=await requireStaffOrAdmin(auth,req); const transition=parts[3],reservationId=parts[2]; const result=transition==="confirm"?await sqlBusiness.transitionReservation(reservationId,"Pending","Confirmed",actor):transition==="preparing"?await sqlBusiness.transitionReservation(reservationId,"Confirmed","Preparing",actor):transition==="ready"?await sqlBusiness.transitionReservation(reservationId,"Preparing","Ready for Pickup",actor):null; if(!result) throw new AppError("NOT_FOUND","Route not found."); return void res.status(200).json(ok(result,"Reservation updated.")); }
    if (sqlBusiness && route==="staff/queue/action" && method==="POST") return void res.status(200).json(ok(await sqlBusiness.queueAction(req.body,await requireStaffOrAdmin(auth,req)),"Queue updated."));
    if (sqlBusiness && route==="staff/inventory/adjust" && method==="POST") return void res.status(200).json(ok(await sqlBusiness.adjustInventory(req.body,await requireStaffOrAdmin(auth,req)),"Inventory adjusted."));
    if (sqlBusiness && route==="staff/inventory/restock" && method==="POST") return void res.status(200).json(ok(await sqlBusiness.restock(req.body,await requireStaffOrAdmin(auth,req),req.headers["idempotency-key"]),"Inventory restocked."));
    if (sqlBusiness && route==="staff/transactions" && method==="POST") { const result=await sqlBusiness.processTransaction(req.body,await requireStaffOrAdmin(auth,req),req.headers["idempotency-key"]); return void res.status(201).json(ok(result,"Transaction completed.",result.reference)); }
    if (route.startsWith("staff/") && method === "GET") { await requireStaffOrAdmin(auth, req); const data=await staffData(route,req.query); if(data===undefined) throw new AppError("NOT_FOUND","Route not found."); return void res.status(200).json(ok(data)); }
    if (route.startsWith("staff/") && method === "POST") { await requireStaffOrAdmin(auth, req); throw new AppError("NOT_FOUND","Route not found."); }
    if (route.startsWith("admin/analytics/") && method === "GET") { await requireAdmin(auth, req); const key = parts[2], data = key === "summary" ? await analytics.getSummary() : key === "sales" ? await analytics.getSalesTrend() : key === "reservations" ? await analytics.getReservationTrend() : key === "products" ? await analytics.getProductDemand() : key === "inventory" ? await analytics.getInventoryHealth() : key === "queue" ? await analytics.getQueuePerformance() : null; if (data === null) throw new AppError("NOT_FOUND", "Route not found."); return void res.status(200).json(ok(data)); }
    if(route==="admin/reports/metrics"&&method==="GET"){await requireAdmin(auth,req);if(!reporting)throw new AppError("CONFIGURATION_ERROR","SQL reporting is unavailable.");return void res.status(200).json(ok(await reporting.metrics(req.query)));}
    if(parts[0]==="admin"&&parts[1]==="reports"&&parts[2]&&parts.length===3&&method==="GET"){await requireAdmin(auth,req);if(!reporting)throw new AppError("CONFIGURATION_ERROR","SQL reporting is unavailable.");const match=/^(reservations|product-movement|inventory|pickups)\.(csv|xlsx|pdf)$/.exec(parts[2]);if(!match)throw new AppError("NOT_FOUND","Report not found.");const type=match[1] as ReportType,format=match[2]!,rows=await reporting.report(type,req.query),body=format==="xlsx"?await toXlsx(type,rows,req.query):format==="pdf"?await toPdf(type,rows,req.query):`\uFEFF${toCsv(rows)}`;res.setHeader("Content-Type",format==="xlsx"?"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":format==="pdf"?"application/pdf":"text/csv; charset=utf-8");res.setHeader("Content-Disposition",`attachment; filename="bulldogs-xchange-${type}.${format}"`);res.setHeader("X-Report-Row-Count",String(rows.length));return void res.status(200).end?.(body);}
    if(parts[0]==="admin"&&parts[1]==="users"&&parts[2]&&parts[3]==="approval-history"&&parts.length===4&&method==="GET"){await requireAdmin(auth,req);if(!sqlAdmin)throw new AppError("CONFIGURATION_ERROR","SQL Admin operations are unavailable.");return void res.status(200).json(ok(await sqlAdmin.approvalHistory(parts[2])));}
    if (route.startsWith("admin/") && parts[1]!=="barky" && method === "GET") { await requireAdmin(auth, req); const data=await adminData(route,req.query); if(data===undefined) throw new AppError("NOT_FOUND","Route not found."); return void res.status(200).json(ok(data)); }
    if (route.startsWith("admin/") && parts[1]!=="barky" && ["POST", "PUT"].includes(method)) { const actor=await requireAdmin(auth,req); if(!knownAdminMutation(method,parts)) throw new AppError("NOT_FOUND","Route not found."); if(!sqlAdmin) throw new AppError("CONFIGURATION_ERROR","SQL Admin operations are unavailable."); let data:unknown; if(method==="POST"&&parts[1]==="products") data=await sqlAdmin.createProduct(req.body,actor); else if(method==="POST"&&parts[1]==="categories") data=await sqlAdmin.createCategory(req.body,actor); else if(method==="POST"&&parts[1]==="variants") data=await sqlAdmin.createVariant(req.body,actor); else if(method==="PUT"&&parts[1]==="products"&&parts[3]==="active") data=await sqlAdmin.setProductActive(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="categories"&&parts[3]==="active") data=await sqlAdmin.setCategoryActive(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="variants"&&parts[3]==="active") data=await sqlAdmin.setVariantActive(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="products") data=await sqlAdmin.updateProduct(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="categories") data=await sqlAdmin.updateCategory(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="variants") data=await sqlAdmin.updateVariant(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="users"&&parts[3]==="role") data=await sqlAdmin.changeUserRole(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="users"&&parts[3]==="approval") data=await sqlAdmin.changeApproval(parts[2]!,req.body,actor); else if(method==="PUT"&&parts[1]==="settings") data=await sqlAdmin.updateSetting(parts[2]!,req.body,actor); else throw new AppError("NOT_FOUND","Route not found."); return void res.status(method==="POST"?201:200).json(ok(data,"Admin operation completed.")); }
    // ---- Barky AI routes --------------------------------------------------------
    if(route==="barky/session"&&method==="POST"){
      if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");
      const actor=await auth.getCurrentUser(req).catch(()=>null);
      const userId=actor?.role&&actor.id?Number(actor.id):null;
      const ipHash=String(req.headers["x-forwarded-for"]??req.headers["x-real-ip"]??"anon").split(",")[0]?.trim().slice(0,64)??"anon";
      const key=`ip:${ipHash}`;
      await barky.checkRateLimit(key);
      const sessionId=await barky.createSession(userId,ipHash);
      return void res.status(201).json(ok({sessionId}));
    }
    if(route==="barky/chat"&&method==="POST"){
      if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");
      const actor=await auth.getCurrentUser(req).catch(()=>null);
      const userId=actor?.role&&actor.id?Number(actor.id):null;
      const ipHash=String(req.headers["x-forwarded-for"]??req.headers["x-real-ip"]??"anon").split(",")[0]?.trim().slice(0,64)??"anon";
      await barky.checkRateLimit(`ip:${ipHash}`);
      const{message,sessionId}=req.body as Record<string,unknown>??{};
      if(!sessionId||typeof sessionId!=="string")throw new AppError("VALIDATION_ERROR","sessionId is required.");
      const session=await barky.getSession(sessionId);
      if(!session)throw new AppError("NOT_FOUND","Barky session not found.");
      if(!canAccessBarkySession(session,userId,ipHash))throw new AppError("FORBIDDEN","This session belongs to another user.");
      const result=await barky.sendMessage(sessionId,String(message??""),userId,requestId);
      return void res.status(200).json(ok(result));
    }
    if(route==="barky/history"&&method==="GET"){
      if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");
      const sessionId=String(req.query?.sessionId??"");
      if(!sessionId)throw new AppError("VALIDATION_ERROR","sessionId is required.");
      const actor=await auth.getCurrentUser(req).catch(()=>null);
      const userId=actor?.role&&actor.id?Number(actor.id):null;
      const ipHash=String(req.headers["x-forwarded-for"]??req.headers["x-real-ip"]??"anon").split(",")[0]?.trim().slice(0,64)??"anon";
      const session=await barky.getSession(sessionId);
      if(!session)throw new AppError("NOT_FOUND","Barky session not found.");
      if(!canAccessBarkySession(session,userId,ipHash))throw new AppError("FORBIDDEN","This session belongs to another user.");
      return void res.status(200).json(ok(await barky.getHistory(sessionId)));
    }
    // ---- Admin Barky management ------------------------------------------
    if(parts[0]==="admin"&&parts[1]==="barky"&&method==="GET"&&parts[2]==="faq"){await requireAdmin(auth,req);if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");return void res.status(200).json(ok(await barky.listFaqs()));}
    if(parts[0]==="admin"&&parts[1]==="barky"&&method==="POST"&&parts[2]==="faq"){await requireAdmin(auth,req);if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");const{question,answer}=(req.body as Record<string,unknown>)??{};return void res.status(201).json(ok(await barky.createFaq(String(question??""),String(answer??"")),"FAQ created."));}
    if(parts[0]==="admin"&&parts[1]==="barky"&&method==="PUT"&&parts[2]==="faq"&&parts[3]){await requireAdmin(auth,req);if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");const{question,answer,isActive}=(req.body as Record<string,unknown>)??{};await barky.updateFaq(Number(parts[3]),String(question??""),String(answer??""),(isActive===true||isActive==="true"));return void res.status(200).json(ok({},"FAQ updated."));}
    if(parts[0]==="admin"&&parts[1]==="barky"&&method==="DELETE"&&parts[2]==="faq"&&parts[3]){await requireAdmin(auth,req);if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");await barky.deleteFaq(Number(parts[3]));return void res.status(200).json(ok({},"FAQ deleted."));}
    if(parts[0]==="admin"&&parts[1]==="barky"&&method==="GET"&&parts[2]==="insights"){await requireAdmin(auth,req);if(!barky)throw new AppError("CONFIGURATION_ERROR","Barky is not available.");return void res.status(200).json(ok(await barky.getInsights()));}
        throw new AppError("NOT_FOUND", "Route not found.");
  } catch (error) { sendError(res, error, requestId); }
}
const queried=(query:RequestLike["query"])=>Boolean(query&&Object.keys(query).length);
async function staffData(route:string,query?:RequestLike["query"]):Promise<unknown>{if(route==="staff/dashboard")return analytics.getSummary();if(route==="staff/reservations")return reporting&&queried(query)?reporting.reservations(query):repository.getReservations();if(route==="staff/queue")return reporting&&queried(query)?reporting.queues(query):repository.getQueues();if(route==="staff/inventory")return analytics.getInventoryHealth();if(route==="staff/inventory/movements")return repository.getInventoryMovements();if(route==="staff/alerts")return(await analytics.getInventoryHealth()).filter(i=>i.lowStock);return undefined;}
async function adminData(route:string,query?:RequestLike["query"]):Promise<unknown>{const key=route.split("/")[1];if(route.split("/").length!==2)return undefined;if(reporting&&queried(query)){if(key==="products")return reporting.products(query);if(key==="reservations")return reporting.reservations(query);if(key==="queue")return reporting.queues(query);if(key==="users")return reporting.users(query);if(key==="audit-logs")return reporting.audits(query);}const map:Record<string,()=>Promise<unknown>>={dashboard:()=>analytics.getSummary(),products:()=>repository.getProducts(),categories:()=>repository.getCategories(),variants:()=>repository.getVariants(),inventory:()=>analytics.getInventoryHealth(),reservations:()=>repository.getReservations(),queue:()=>repository.getQueues(),transactions:()=>repository.getTransactions(),users:()=>repository.getUsers(),"audit-logs":()=>repository.getAuditLogs(),settings:()=>repository.getSystemSettings()};return map[key??""]?.();}
