import { AppError } from "./lib/errors.js";
import { ok, secure, sendError, type RequestLike, type ResponseLike } from "./lib/http.js";
import { createMockRepository } from "./repositories/mock-repository.js";
import { AnalyticsService } from "./services/analytics-service.js";
import { AuthService, requireAdmin, requireAuthenticated, requireCustomer, requireStaffOrAdmin } from "./services/auth-service.js";
import { CatalogService } from "./services/catalog-service.js";
import { QueueService } from "./services/queue-service.js";
import { ReservationService } from "./services/reservation-service.js";

export const repository = createMockRepository();
const auth = new AuthService(repository); const catalog = new CatalogService(repository); const reservations = new ReservationService(repository, catalog); const queue = new QueueService(repository); const analytics = new AnalyticsService(repository);
const bool = (value: unknown) => value === undefined ? undefined : String(value) === "true";
const pathOf = (req: RequestLike) => new URL(req.url ?? "/", "http://localhost").pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);

export async function handle(req: RequestLike, res: ResponseLike): Promise<void> {
  secure(res); if (req.method === "OPTIONS") { res.setHeader("Allow", "GET,POST,PUT,OPTIONS"); res.status(204).end?.(); return; }
  try {
    const method = req.method ?? "GET"; const parts = pathOf(req); const route = parts.join("/"); const id = parts[1];
    if (method === "GET" && route === "health") return void res.status(200).json(ok({ status: "healthy", service: "bulldogs-xchange" }));
    if (method === "GET" && route === "config/public") return void res.status(200).json(ok({ campusPickupOnly: true }));
    if (method === "GET" && route === "me") return void res.status(200).json(ok(requireAuthenticated(auth, req)));
    if (method === "GET" && route === "categories") return void res.status(200).json(ok(catalog.getCategories()));
    if (method === "GET" && route === "products") return void res.status(200).json(ok(catalog.getProducts({ search: String(req.query?.search ?? "") || undefined, category: String(req.query?.category ?? "") || undefined, featured: bool(req.query?.featured), active: bool(req.query?.active), sort: req.query?.sort as "title" | "price" | "-price" | undefined })));
    if (method === "GET" && parts[0] === "products" && id && parts.length === 2) return void res.status(200).json(ok(catalog.getProduct(id)));
    if (method === "GET" && parts[0] === "products" && id && parts[2] === "variants") return void res.status(200).json(ok(catalog.getVariants(id)));
    if (method === "GET" && parts[0] === "products" && id && parts[2] === "availability") return void res.status(200).json(ok(catalog.getAvailability(id)));
    if (route === "reservations" && method === "GET") return void res.status(200).json(ok(reservations.list(requireAuthenticated(auth, req))));
    if (route === "reservations" && method === "POST") { const item = reservations.create(req.body, requireCustomer(auth, req)); return void res.status(201).json(ok(item, "Reservation created successfully.", item.reference)); }
    if (parts[0] === "reservations" && id && parts.length === 2 && method === "GET") return void res.status(200).json(ok(reservations.get(id, requireAuthenticated(auth, req))));
    if (parts[0] === "reservations" && id && parts[2] === "cancel" && method === "POST") return void res.status(200).json(ok(reservations.cancel(id, requireCustomer(auth, req)), "Reservation cancelled."));
    if (route === "queue/me" && method === "GET") return void res.status(200).json(ok(queue.mine(requireCustomer(auth, req))));
    if (route === "queue/status" && method === "GET") return void res.status(200).json(ok(queue.status()));
    if (route === "queue/join" && method === "POST") return void res.status(201).json(ok(queue.join(req.body, requireCustomer(auth, req)), "Joined pickup queue."));
    if (route === "queue/leave" && method === "POST") return void res.status(200).json(ok(queue.leave(requireCustomer(auth, req)), "Left pickup queue."));
    if (route === "notifications" && method === "GET") { const user = requireAuthenticated(auth, req); return void res.status(200).json(ok(repository.notifications.filter((n) => n.recipientEmail === user.email))); }
    if (parts[0] === "notifications" && id && parts[2] === "read" && method === "POST") { const user = requireAuthenticated(auth, req); const item = repository.notifications.find((n) => n.id === id && n.recipientEmail === user.email); if (!item) throw new AppError("NOT_FOUND", "Notification not found."); item.isRead = true; return void res.status(200).json(ok(item)); }
    if (route === "notifications/read-all" && method === "POST") { const user = requireAuthenticated(auth, req); repository.notifications.filter((n) => n.recipientEmail === user.email).forEach((n) => n.isRead = true); return void res.status(200).json(ok(null, "Notifications marked read.")); }
    if (route === "profile" && method === "GET") return void res.status(200).json(ok(requireAuthenticated(auth, req)));
    if (route.startsWith("staff/") && method === "GET") { requireStaffOrAdmin(auth, req); return void res.status(200).json(ok(staffData(route))); }
    if (route.startsWith("staff/") && method === "POST") { requireStaffOrAdmin(auth, req); return void res.status(200).json(ok(req.body ?? null, "Staff operation accepted.")); }
    if (route.startsWith("admin/analytics/") && method === "GET") { requireAdmin(auth, req); const key = parts[2]; const data = key === "summary" ? analytics.getSummary() : key === "sales" ? analytics.getSalesTrend() : key === "reservations" ? analytics.getReservationTrend() : key === "products" ? analytics.getProductDemand() : key === "inventory" ? analytics.getInventoryHealth() : key === "queue" ? analytics.getQueuePerformance() : null; if (data === null) throw new AppError("NOT_FOUND", "Route not found."); return void res.status(200).json(ok(data)); }
    if (route.startsWith("admin/") && method === "GET") { requireAdmin(auth, req); return void res.status(200).json(ok(adminData(route))); }
    if (route.startsWith("admin/") && ["POST", "PUT"].includes(method)) { requireAdmin(auth, req); return void res.status(200).json(ok(req.body ?? null, "Admin operation accepted.")); }
    throw new AppError("NOT_FOUND", "Route not found.");
  } catch (error) { sendError(res, error); }
}

function staffData(route: string): unknown { if (route === "staff/dashboard") return analytics.getSummary(); if (route.startsWith("staff/reservations")) return repository.reservations; if (route === "staff/inventory") return analytics.getInventoryHealth(); if (route === "staff/inventory/movements") return repository.movements; if (route === "staff/alerts") return analytics.getInventoryHealth().filter((i) => i.lowStock); return []; }
function adminData(route: string): unknown { const key = route.split("/")[1]; const map: Record<string, unknown> = { dashboard: analytics.getSummary(), products: repository.products, categories: repository.categories, variants: repository.variants, inventory: analytics.getInventoryHealth(), reservations: repository.reservations, queue: repository.queues, transactions: repository.transactions, users: repository.users, "audit-logs": repository.auditLogs, settings: repository.settings }; return map[key ?? ""] ?? []; }

