import { beforeEach, describe, expect, it } from "vitest";
import { handle, repository } from "../src/app.js";
import { AuthService, requireAdmin } from "../src/services/auth-service.js";
import { CatalogService } from "../src/services/catalog-service.js";
import { ReservationService } from "../src/services/reservation-service.js";

function request(method: string, url: string, body?: unknown, user = "customer@example.test") { return { method, url, body, query: Object.fromEntries(new URL(url, "http://local").searchParams), headers: { "x-dev-user": user } }; }
function response() { const state: { status: number; body?: any } = { status: 0 }; return { state, status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; }, setHeader() {}, end() {} }; }

beforeEach(() => { process.env.ENABLE_DEV_AUTH = "true"; process.env.NODE_ENV = "test"; repository.reservations.splice(1); repository.reservationItems.splice(1); repository.inventory[0]!.reservedQuantity = 2; repository.queues.splice(1); repository.notifications[0]!.isRead = false; });

describe("backend foundation", () => {
  it("returns health and the standard response shape", async () => { const res = response(); await handle(request("GET", "/api/health"), res); expect(res.state).toMatchObject({ status: 200, body: { success: true, reference: null, data: { status: "healthy" } } }); });
  it("filters catalog", () => { const catalog = new CatalogService(repository); expect(catalog.getProducts({ search: "shirt", featured: true })).toHaveLength(1); expect(catalog.getProducts({ search: "missing" })).toHaveLength(0); });
  it("calculates availability", () => { expect(new CatalogService(repository).available("var-1")).toBe(18); });
  it("validates reservation quantity", () => { const user = repository.users[0]!; const service = new ReservationService(repository, new CatalogService(repository)); expect(() => service.create({ items: [{ productVariantId: "var-1", quantity: 0 }] }, user)).toThrow("Too small"); });
  it("rejects insufficient stock", () => { const service = new ReservationService(repository, new CatalogService(repository)); expect(() => service.create({ items: [{ productVariantId: "var-1", quantity: 99 }] }, repository.users[0]!)).toThrow("Insufficient stock"); });
  it("only cancels eligible reservations", () => { repository.reservations[0]!.status = "Completed"; const service = new ReservationService(repository, new CatalogService(repository)); expect(() => service.cancel("res-1", repository.users[0]!)).toThrow("cannot be cancelled"); });
  it("rejects duplicate queue joins", async () => { const res = response(); await handle(request("POST", "/api/queue/join", {}), res); expect(res.state).toMatchObject({ status: 409, body: { success: false, error: { code: "QUEUE_ALREADY_JOINED" } } }); });
  it("enforces roles and admin restriction", () => { const auth = new AuthService(repository); expect(() => requireAdmin(auth, request("GET", "/api/admin/dashboard"))).toThrow("Insufficient permissions"); expect(requireAdmin(auth, request("GET", "/api/admin/dashboard", undefined, "admin@example.test")).role).toBe("Admin"); });
  it("uses a safe API error shape", async () => { const res = response(); await handle(request("GET", "/api/nope"), res); expect(res.state.body).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Route not found." } }); });
});

