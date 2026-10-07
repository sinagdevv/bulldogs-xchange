import { beforeEach, describe, expect, it } from "vitest";
import { handle, repository } from "../src/app.js";
import { AuthService, requireAdmin } from "../src/services/auth-service.js";
import { CatalogService } from "../src/services/catalog-service.js";
import { ReservationService } from "../src/services/reservation-service.js";
import { MockSharePointRepository } from "../src/repositories/mock-repository.js";

function request(method: string, url: string, body?: unknown, user = "customer@example.test") { return { method, url, body, query: Object.fromEntries(new URL(url, "http://local").searchParams), headers: { "x-dev-user": user } }; }
function response() { const state: { status: number; body?: any } = { status: 0 }; return { state, status(code: number) { state.status = code; return this; }, json(body: unknown) { state.body = body; }, setHeader() {}, end() {} }; }

const mock = repository as MockSharePointRepository;
beforeEach(() => { process.env.ENABLE_DEV_AUTH = "true"; process.env.NODE_ENV = "test"; mock.reservations.splice(1); mock.reservationItems.splice(1); mock.inventory[0]!.reservedQuantity = 2; mock.queues.splice(1); mock.notifications[0]!.isRead = false; });

describe("backend foundation", () => {
  it("returns health and the standard response shape", async () => { const res = response(); await handle(request("GET", "/api/health"), res); expect(res.state).toMatchObject({ status: 200, body: { success: true, reference: null, data: { status: "healthy" } } }); });
  it("filters catalog", async () => { const catalog = new CatalogService(repository); expect(await catalog.getProducts({ search: "shirt", featured: true })).toHaveLength(1); expect(await catalog.getProducts({ search: "missing" })).toHaveLength(0); });
  it("calculates availability", async () => { expect(await new CatalogService(repository).available("var-1")).toBe(18); });
  it("validates reservation quantity", async () => { const service = new ReservationService(repository, new CatalogService(repository)); await expect(service.create({ items: [{ productVariantId: "var-1", quantity: 0 }] }, mock.users[0]!)).rejects.toThrow("Too small"); });
  it("rejects insufficient stock", async () => { const service = new ReservationService(repository, new CatalogService(repository)); await expect(service.create({ items: [{ productVariantId: "var-1", quantity: 99 }] }, mock.users[0]!)).rejects.toThrow("Insufficient stock"); });
  it("only cancels eligible reservations", async () => { mock.reservations[0]!.status = "Completed"; const service = new ReservationService(repository, new CatalogService(repository)); await expect(service.cancel("res-1", mock.users[0]!)).rejects.toThrow("cannot be cancelled"); });
  it("rejects duplicate queue joins", async () => { const res = response(); await handle(request("POST", "/api/queue/join", {}), res); expect(res.state).toMatchObject({ status: 409, body: { success: false, error: { code: "QUEUE_ALREADY_JOINED" } } }); });
  it("enforces roles and admin restriction", async () => { const auth = new AuthService(repository); await expect(requireAdmin(auth, request("GET", "/api/admin/dashboard"))).rejects.toThrow("Insufficient permissions"); expect((await requireAdmin(auth, request("GET", "/api/admin/dashboard", undefined, "admin@example.test"))).role).toBe("Admin"); });
  it("uses a safe API error shape", async () => { const res = response(); await handle(request("GET", "/api/nope"), res); expect(res.state.body).toEqual({ success: false, error: { code: "NOT_FOUND", message: "Route not found." } }); });
});
