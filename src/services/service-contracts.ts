export interface InventoryService { getAvailability(productVariantId: string): number }
export interface TransactionService { process(input: unknown): Promise<unknown> }
export interface NotificationService { list(recipientEmail: string): unknown[] }
export interface UserService { getByEmail(email: string): unknown }
export interface AdminService { getDashboard(): unknown }
export interface AuditService { record(action: string, entity: string): void }
export interface SettingsService { get(key: string): string | undefined }

