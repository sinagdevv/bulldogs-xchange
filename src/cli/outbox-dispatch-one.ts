import { SqlServerConnectionManager } from "../integrations/sql-server.js";
import { PostgresConnectionManager } from "../integrations/postgres.js";
import { OutboxDispatcher } from "../services/outbox-dispatcher.js";

const db=["supabase","postgres"].includes(process.env.DATA_PROVIDER??"")?new PostgresConnectionManager():new SqlServerConnectionManager(), [eventId,...extra]=process.argv.slice(2);
try {
  if(!eventId||extra.length) throw new Error("Usage: npm run outbox:dispatch-one -- <EventId>");
  const result=await new OutboxDispatcher(db).dispatchEvent(eventId);
  console.log(JSON.stringify(result));
  if(result.delivered!==1) process.exitCode=1;
} catch(error) { console.error(error instanceof Error?error.message:"Targeted dispatch failed."); process.exitCode=1; }
finally { await db.closePool(); }
