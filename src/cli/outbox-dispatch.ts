import { SqlServerConnectionManager } from "../integrations/sql-server.js";
import { PostgresConnectionManager } from "../integrations/postgres.js";
import { OutboxDispatcher } from "../services/outbox-dispatcher.js";

const db=["supabase","postgres"].includes(process.env.DATA_PROVIDER??"")?new PostgresConnectionManager():new SqlServerConnectionManager();
try { console.log(JSON.stringify(await new OutboxDispatcher(db).dispatchBatch())); }
finally { await db.closePool(); }
