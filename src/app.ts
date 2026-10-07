import { timingSafeEqual } from "node:crypto";
import { AppError } from "./lib/errors.js";
import { ok, secure, sendError, type RequestLike, type ResponseLike } from "./lib/http.js";
import { createRepository, isMockRepository } from "./repositories/provider.js";
import { ProductionSharePointRepository } from "./repositories/production-sharepoint-repository.js";
import { SqlServerRepository } from "./repositories/sql-server-repository.js";
import { SqlServerConnectionManager } from "./integrations/sql-server.js";
import { AnalyticsService } from "./services/analytics-service.js";
import { AuthService, requireAdmin, requireAuthenticated, requireCustomer, requireStaffOrAdmin } from "./services/auth-service.js";
import { CatalogService } from "./services/catalog-service.js";
import { QueueService } from "./services/queue-service.js";
import { ReservationService } from "./services/reservation-service.js";
import { SqlBusinessService } from "./services/sql-business-service.js";
import { OutboxDispatcher } from "./services/outbox-dispatcher.js";

export const repository = createRepository();
const auth = new AuthService(repository), catalog = new CatalogService(repository), reservations = new ReservationService(repository, catalog), queue = new QueueService(repository), analytics = new AnalyticsService(repository);
const sqlBusiness = repository instanceof SqlServerRepository && repository.db instanceof SqlServerConnectionManager ? new SqlBusinessService(repository.db) : null;
const outbox = repository instanceof SqlServerRepository && repository.db instanceof SqlServerConnectionManager ? new OutboxDispatcher(repository.db) : null;
const bool = (value: unknown) => value === undefined ? undefined : String(value) === "true";
const pathOf = (req: RequestLike) => new URL(req.url ?? "/", "http://localhost").pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
const requireDispatchSecret=(req:RequestLike)=>{const expected=process.env.OUTBOX_DISPATCH_SECRET,provided=String(req.headers.authorization??"").replace(/^Bearer\s+/i,""); if(!expected||!provided||Buffer.byteLength(expected)!==Buffer.byteLength(provided)||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided))) throw new AppError("UNAUTHORIZED","Invalid internal authorization.");};

export async function handle(req: RequestLike, res: ResponseLike): Promise<void> {
  secure(res); if (req.method === "OPTIONS") { res.setHeader("Allow", "GET,POST,PUT,OPTIONS"); res.status(204).end?.(); return; }
  try {
    const method = req.method ?? "GET", parts = pathOf(req), route = parts.join("/"), id = parts[1];
    if (method === "GET" && route === "health") return void res.status(200).json(ok({ status: "healthy", service: "bulldogs-xchange" }));
    if(route.startsWith("internal/outbox/")&&!outbox) throw new AppError("CONFIGURATION_ERROR","SQL outbox is unavailable.");
    if(route.startsWith("internal/outbox/")){requireDispatchSecret(req); if(route==="internal/outbox/dispatch"&&method==="POST") return void res.status(200).json(ok(await outbox!.dispatchBatch())); if(route==="internal/outbox/health"&&method==="GET") return void res.status(200).json(ok(await outbox!.health())); if(route==="internal/outbox/dead-letters"&&method==="GET") return void res.status(200).json(ok(await outbox!.deadLetters())); if(parts[2]==="dead-letters"&&parts[3]&&parts[4]==="retry"&&method==="POST") return void res.status(200).json(ok(await outbox!.retryDeadLetter(parts[3])));}
    if (method === "GET" && route === "internal/integrations/sharepoint") { if (process.env.NODE_ENV === "production") await requireAdmin(auth, req); if (!(repository instanceof ProductionSharePointRepository)) return void res.status(200).json(ok({ configured: false, reachable: false, site: null, listsResolved: 0 })); return void res.status(200).json(ok(await repository.health())); }
    if (method === "GET" && route === "config/public") return void res.status(200).json(ok({ campusPickupOnly: true }));
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
    if (parts[0] === "notifications" && id && parts[2] === "read" && method === "POST") { const user = await requireAuthenticated(auth, req); if (!isMockRepository(repository)) throw new AppError("CONFIGURATION_ERROR", "Notification writes are not implemented for the selected data provider."); const item = repository.notifications.find((n) => n.id === id && n.recipientEmail === user.email); if (!item) throw new AppError("NOT_FOUND", "Notification not found."); item.isRead = true; return void res.status(200).json(ok(item)); }
    if (route === "notifications/read-all" && method === "POST") { const user = await requireAuthenticated(auth, req); if (!isMockRepository(repository)) throw new AppError("CONFIGURATION_ERROR", "Notification writes are not implemented for the selected data provider."); repository.notifications.filter((n) => n.recipientEmail === user.email).forEach((n) => n.isRead = true); return void res.status(200).json(ok(null, "Notifications marked read.")); }
    if (route === "profile" && method === "GET") return void res.status(200).json(ok(await requireAuthenticated(auth, req)));
    if (sqlBusiness && parts[0]==="staff" && parts[1]==="reservations" && parts[2] && method==="POST") { const actor=await requireStaffOrAdmin(auth,req); const transition=parts[3],reservationId=parts[2]; const result=transition==="confirm"?await sqlBusiness.transitionReservation(reservationId,"Pending","Confirmed",actor):transition==="preparing"?await sqlBusiness.transitionReservation(reservationId,"Confirmed","Preparing",actor):transition==="ready"?await sqlBusiness.transitionReservation(reservationId,"Preparing","Ready for Pickup",actor):null; if(!result) throw new AppError("NOT_FOUND","Route not found."); return void res.status(200).json(ok(result,"Reservation updated.")); }
    if (sqlBusiness && route==="staff/queue/action" && method==="POST") return void res.status(200).json(ok(await sqlBusiness.queueAction(req.body,await requireStaffOrAdmin(auth,req)),"Queue updated."));
    if (sqlBusiness && route==="staff/inventory/adjust" && method==="POST") return void res.status(200).json(ok(await sqlBusiness.adjustInventory(req.body,await requireStaffOrAdmin(auth,req)),"Inventory adjusted."));
    if (sqlBusiness && route==="staff/inventory/restock" && method==="POST") return void res.status(200).json(ok(await sqlBusiness.restock(req.body,await requireStaffOrAdmin(auth,req),req.headers["idempotency-key"]),"Inventory restocked."));
    if (sqlBusiness && route==="staff/transactions" && method==="POST") { const result=await sqlBusiness.processTransaction(req.body,await requireStaffOrAdmin(auth,req),req.headers["idempotency-key"]); return void res.status(201).json(ok(result,"Transaction completed.",result.reference)); }
    if (route.startsWith("staff/") && method === "GET") { await requireStaffOrAdmin(auth, req); return void res.status(200).json(ok(await staffData(route))); }
    if (route.startsWith("staff/") && method === "POST") { await requireStaffOrAdmin(auth, req); return void res.status(200).json(ok(req.body ?? null, "Staff operation accepted.")); }
    if (route.startsWith("admin/analytics/") && method === "GET") { await requireAdmin(auth, req); const key = parts[2], data = key === "summary" ? await analytics.getSummary() : key === "sales" ? await analytics.getSalesTrend() : key === "reservations" ? await analytics.getReservationTrend() : key === "products" ? await analytics.getProductDemand() : key === "inventory" ? await analytics.getInventoryHealth() : key === "queue" ? await analytics.getQueuePerformance() : null; if (data === null) throw new AppError("NOT_FOUND", "Route not found."); return void res.status(200).json(ok(data)); }
    if (route.startsWith("admin/") && method === "GET") { await requireAdmin(auth, req); return void res.status(200).json(ok(await adminData(route))); }
    if (route.startsWith("admin/") && ["POST", "PUT"].includes(method)) { await requireAdmin(auth, req); return void res.status(200).json(ok(req.body ?? null, "Admin operation accepted.")); }
    throw new AppError("NOT_FOUND", "Route not found.");
  } catch (error) { sendError(res, error); }
}
async function staffData(route: string): Promise<unknown> { if (route === "staff/dashboard") return analytics.getSummary(); if (route.startsWith("staff/reservations")) return repository.getReservations(); if (route === "staff/inventory") return analytics.getInventoryHealth(); if (route === "staff/inventory/movements") return repository.getInventoryMovements(); if (route === "staff/alerts") return (await analytics.getInventoryHealth()).filter((i) => i.lowStock); return []; }
async function adminData(route: string): Promise<unknown> { const key = route.split("/")[1]; const map: Record<string, () => Promise<unknown>> = { dashboard: () => analytics.getSummary(), products: () => repository.getProducts(), categories: () => repository.getCategories(), variants: () => repository.getVariants(), inventory: () => analytics.getInventoryHealth(), reservations: () => repository.getReservations(), queue: () => repository.getQueues(), transactions: () => repository.getTransactions(), users: () => repository.getUsers(), "audit-logs": () => repository.getAuditLogs(), settings: () => repository.getSystemSettings() }; return map[key ?? ""]?.() ?? []; }
