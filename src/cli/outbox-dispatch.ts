import { SqlServerConnectionManager } from "../integrations/sql-server.js";
import { OutboxDispatcher } from "../services/outbox-dispatcher.js";

const db=new SqlServerConnectionManager();
try { console.log(JSON.stringify(await new OutboxDispatcher(db).dispatchBatch())); }
finally { await db.closePool(); }
