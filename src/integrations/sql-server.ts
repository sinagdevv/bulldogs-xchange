import sql from "mssql";
import { AppError } from "../lib/errors.js";
export type SqlParams = Record<string, string | number | boolean | Date | null>;
export interface SqlExecutor { dialect?: "mssql" | "postgres"; query<T>(statement: string, params?: SqlParams): Promise<T[]> }
export interface SqlTransactionManager extends SqlExecutor { transaction<T>(work: (executor: SqlExecutor) => Promise<T>): Promise<T> }
export async function withRollback<T>(commit: () => Promise<void>, rollback: () => Promise<void>, work: () => Promise<T>): Promise<T> { try { const value = await work(); await commit(); return value; } catch (error) { await rollback(); throw error; } }
function configuration(): sql.config { const server = process.env.SQL_SERVER, database = process.env.SQL_DATABASE, user = process.env.SQL_USER, password = process.env.SQL_PASSWORD; if (!server || !database || !user || !password) throw new AppError("CONFIGURATION_ERROR", "SQL Server is not configured."); return { server, database, user, password, port: Number(process.env.SQL_PORT ?? 1433), options: { encrypt: process.env.SQL_ENCRYPT === "true", trustServerCertificate: process.env.SQL_TRUST_SERVER_CERTIFICATE === "true" }, pool: { min: 0, max: 10, idleTimeoutMillis: 30000 } }; }
function bind(request: sql.Request, params: SqlParams) { for (const [name, value] of Object.entries(params)) request.input(name, value); return request; }
export class SqlServerConnectionManager implements SqlExecutor {
  readonly dialect = "mssql" as const;
  private pool?: sql.ConnectionPool;
  async getPool() { if (!this.pool) this.pool = await new sql.ConnectionPool(configuration()).connect().catch(() => { throw new AppError("EXTERNAL_SERVICE_ERROR", "SQL Server connection failed."); }); return this.pool; }
  async closePool() { if (this.pool) await this.pool.close(); this.pool = undefined; }
  async query<T>(statement: string, params: SqlParams = {}) { try { const result = await bind((await this.getPool()).request(), params).query<T>(statement); return result.recordset; } catch (error) { if (error instanceof AppError) throw error; throw new AppError("EXTERNAL_SERVICE_ERROR", "SQL Server query failed."); } }
  async transaction<T>(work: (executor: SqlExecutor) => Promise<T>): Promise<T> { const transaction = new sql.Transaction(await this.getPool()); await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); return withRollback(() => transaction.commit(), () => transaction.rollback(), () => work({ query: async <R>(statement: string, params: SqlParams = {}) => (await bind(new sql.Request(transaction), params).query<R>(statement)).recordset })); }
}
