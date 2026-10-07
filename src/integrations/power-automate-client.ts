import { AppError } from "../lib/errors.js";

type Operation = "createReservation" | "cancelReservation" | "markReady" | "queueAction" | "adjustStock" | "restock" | "processTransaction" | "saveProduct" | "setProductActive" | "saveCategory" | "setCategoryActive" | "saveVariant" | "setVariantActive" | "changeUserRole" | "saveSetting";
const environment: Record<Operation, string> = { createReservation: "PA_CREATE_RESERVATION_URL", cancelReservation: "PA_CANCEL_RESERVATION_URL", markReady: "PA_MARK_READY_URL", queueAction: "PA_QUEUE_ACTION_URL", adjustStock: "PA_ADJUST_STOCK_URL", restock: "PA_RESTOCK_URL", processTransaction: "PA_PROCESS_TRANSACTION_URL", saveProduct: "PA_SAVE_PRODUCT_URL", setProductActive: "PA_SET_PRODUCT_ACTIVE_URL", saveCategory: "PA_SAVE_CATEGORY_URL", setCategoryActive: "PA_SET_CATEGORY_ACTIVE_URL", saveVariant: "PA_SAVE_VARIANT_URL", setVariantActive: "PA_SET_VARIANT_ACTIVE_URL", changeUserRole: "PA_CHANGE_USER_ROLE_URL", saveSetting: "PA_SAVE_SETTING_URL" };

export class PowerAutomateClient {
  constructor(private fetcher: typeof fetch = fetch, private timeoutMs = 8000) {}
  private async call(operation: Operation, body: unknown): Promise<unknown> {
    const url = process.env[environment[operation]]; if (!url) throw new AppError("CONFIGURATION_ERROR", `${environment[operation]} is not configured.`);
    try { const response = await this.fetcher(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(this.timeoutMs) }); if (!response.ok) throw new Error(String(response.status)); return await response.json(); }
    catch { throw new AppError("EXTERNAL_SERVICE_ERROR", "Workflow request failed."); }
  }
  createReservation = (body: unknown) => this.call("createReservation", body); cancelReservation = (body: unknown) => this.call("cancelReservation", body);
  markReady = (body: unknown) => this.call("markReady", body); queueAction = (body: unknown) => this.call("queueAction", body);
  adjustStock = (body: unknown) => this.call("adjustStock", body); restock = (body: unknown) => this.call("restock", body);
  processTransaction = (body: unknown) => this.call("processTransaction", body); saveProduct = (body: unknown) => this.call("saveProduct", body);
  setProductActive = (body: unknown) => this.call("setProductActive", body); saveCategory = (body: unknown) => this.call("saveCategory", body);
  setCategoryActive = (body: unknown) => this.call("setCategoryActive", body); saveVariant = (body: unknown) => this.call("saveVariant", body);
  setVariantActive = (body: unknown) => this.call("setVariantActive", body); changeUserRole = (body: unknown) => this.call("changeUserRole", body);
  saveSetting = (body: unknown) => this.call("saveSetting", body);
}

