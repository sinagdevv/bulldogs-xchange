import { z } from "zod";
import { AppError } from "../lib/errors.js";
import { PowerAutomateHttpClient } from "./power-automate-http-client.js";

const operations = { createReservation: "PA_CREATE_RESERVATION_URL", cancelReservation: "PA_CANCEL_RESERVATION_URL", markReady: "PA_MARK_READY_URL", queueAction: "PA_QUEUE_ACTION_URL", adjustStock: "PA_ADJUST_STOCK_URL", restock: "PA_RESTOCK_URL", processTransaction: "PA_PROCESS_TRANSACTION_URL", saveProduct: "PA_SAVE_PRODUCT_URL", setProductActive: "PA_SET_PRODUCT_ACTIVE_URL", saveCategory: "PA_SAVE_CATEGORY_URL", setCategoryActive: "PA_SET_CATEGORY_ACTIVE_URL", saveVariant: "PA_SAVE_VARIANT_URL", setVariantActive: "PA_SET_VARIANT_ACTIVE_URL", changeUserRole: "PA_CHANGE_USER_ROLE_URL", saveSetting: "PA_SAVE_SETTING_URL" } as const;
type Operation = keyof typeof operations;
const connectionResponse = z.object({ success: z.literal(true), message: z.literal("Bulldogs Xchange API reachable") });
const notificationResponse = z.object({ success: z.literal(true), eventId: z.string().uuid(), message: z.literal("Notification accepted.") });
export type NotificationEvent = { eventId:string; eventType:"ReservationCreated"|"ReservationCancelled"|"ReservationReady"|"QueueCalled"|"TransactionCompleted"; occurredAt:string; recipient:{email:string;name:string}; data:Record<string,unknown> };
export class PowerAutomateClient {
  constructor(private http = new PowerAutomateHttpClient()) {}
  async testConnection() { const response = await this.http.request<Record<string, never>, unknown>("testConnection", process.env.PA_TEST_URL, {}); const parsed = connectionResponse.safeParse(response); if (!parsed.success) throw new AppError("EXTERNAL_SERVICE_ERROR", "Power Automate test response was invalid."); return parsed.data; }
  async notifyEvent(event:NotificationEvent) { const response=await this.http.request<NotificationEvent,unknown>("notifyEvent",process.env.PA_NOTIFY_EVENT_URL,event); const parsed=notificationResponse.safeParse(response); if(!parsed.success||parsed.data.eventId!==event.eventId) throw new AppError("EXTERNAL_SERVICE_ERROR","Power Automate notification response was invalid."); return parsed.data; }
  private call(operation: Operation, body: unknown) { return this.http.request(operation, process.env[operations[operation]], body); }
  createReservation = (body: unknown) => this.call("createReservation", body); cancelReservation = (body: unknown) => this.call("cancelReservation", body);
  markReady = (body: unknown) => this.call("markReady", body); queueAction = (body: unknown) => this.call("queueAction", body);
  adjustStock = (body: unknown) => this.call("adjustStock", body); restock = (body: unknown) => this.call("restock", body);
  processTransaction = (body: unknown) => this.call("processTransaction", body); saveProduct = (body: unknown) => this.call("saveProduct", body);
  setProductActive = (body: unknown) => this.call("setProductActive", body); saveCategory = (body: unknown) => this.call("saveCategory", body);
  setCategoryActive = (body: unknown) => this.call("setCategoryActive", body); saveVariant = (body: unknown) => this.call("saveVariant", body);
  setVariantActive = (body: unknown) => this.call("setVariantActive", body); changeUserRole = (body: unknown) => this.call("changeUserRole", body);
  saveSetting = (body: unknown) => this.call("saveSetting", body);
}
