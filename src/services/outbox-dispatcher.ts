import { AppError } from "../lib/errors.js";
import type { SqlExecutor } from "../integrations/sql-server.js";
import { PowerAutomateClient, type NotificationEvent } from "../integrations/power-automate-client.js";

type Row = Record<string, unknown>;
export type OutboxEvent = { id: number; eventId: string; eventType: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown>; attempt: number; createdAt: Date };
const supported = new Set(["ReservationCreated", "ReservationCancelled", "ReservationReady", "QueueCalled", "TransactionCompleted"]);
const positive = (value: string | undefined, fallback: number, max: number) => { const parsed=Number(value); return Number.isInteger(parsed)&&parsed>0?Math.min(parsed,max):fallback; };
const safeError = (error: unknown) => (error instanceof Error ? error.message : "Dispatch failed.").replace(/https?:\/\/\S+/gi,"[redacted]").replace(/(secret|authorization|password)\s*[:=]\s*\S+/gi,"$1=[redacted]").slice(0,500);
const delaySeconds = (attempt: number) => [0,30,120,600,1800][Math.min(attempt,4)]!;

export class OutboxDispatcher {
  constructor(private db: SqlExecutor, private automation = new PowerAutomateClient(), private log: (entry: Record<string,unknown>)=>void = (entry)=>console.info(JSON.stringify(entry))) {}

  async claimBatch(limit = positive(process.env.OUTBOX_BATCH_SIZE,10,100)): Promise<OutboxEvent[]> {
    const batch=positive(String(limit),10,100), lease=positive(process.env.OUTBOX_LEASE_SECONDS,120,3600);
    return (await this.db.query<Row>(`;
WITH eligible AS (
  SELECT TOP (@limit) * FROM dbo.AutomationOutbox WITH (UPDLOCK,READPAST,ROWLOCK)
  WHERE (Status=N'Pending' AND COALESCE(NextAttemptAt,CreatedAt)<=SYSUTCDATETIME())
     OR (Status=N'Processing' AND LockedAt<DATEADD(second,-@lease,SYSUTCDATETIME()))
  ORDER BY CreatedAt
)
UPDATE eligible SET Status=N'Processing',Attempts=Attempts+1,LockedAt=SYSUTCDATETIME(),ProcessedAt=SYSUTCDATETIME()
OUTPUT INSERTED.AutomationEventId,INSERTED.EventId,INSERTED.EventType,INSERTED.AggregateType,INSERTED.AggregateId,INSERTED.Payload,INSERTED.Attempts,INSERTED.CreatedAt;`,{limit:batch,lease})).map((row)=>({id:Number(row.AutomationEventId),eventId:String(row.EventId),eventType:String(row.EventType),aggregateType:String(row.AggregateType),aggregateId:String(row.AggregateId),payload:JSON.parse(String(row.Payload)) as Record<string,unknown>,attempt:Number(row.Attempts),createdAt:new Date(row.CreatedAt as string|Date)}));
  }

  private async notification(event: OutboxEvent): Promise<NotificationEvent> {
    if(!supported.has(event.eventType)) throw new AppError("EXTERNAL_SERVICE_ERROR",`Unsupported outbox event type: ${event.eventType}`);
    let row: Row|undefined;
    if(event.aggregateType==="Reservation") row=(await this.db.query<Row>("SELECT r.Reference,u.Email,u.FullName,r.ExpiresAt FROM dbo.Reservations r JOIN dbo.Users u ON u.UserId=r.CustomerId WHERE r.ReservationId=@id",{id:Number(event.aggregateId)}))[0];
    else if(event.aggregateType==="QueueEntry") row=(await this.db.query<Row>("SELECT q.QueueNumber,r.Reference,qt.QueueTypeName,u.Email,u.FullName FROM dbo.QueueEntries q JOIN dbo.Reservations r ON r.ReservationId=q.ReservationId JOIN dbo.QueueTypes qt ON qt.QueueTypeId=q.QueueTypeId JOIN dbo.Users u ON u.UserId=q.CustomerId WHERE q.QueueEntryId=@id",{id:Number(event.aggregateId)}))[0];
    else if(event.aggregateType==="Transaction") row=(await this.db.query<Row>("SELECT t.Reference TransactionReference,r.Reference,t.TotalAmount,u.Email,u.FullName FROM dbo.Transactions t JOIN dbo.Reservations r ON r.ReservationId=t.ReservationId JOIN dbo.Users u ON u.UserId=t.CustomerId WHERE t.TransactionId=@id",{id:Number(event.aggregateId)}))[0];
    if(!row?.Email) throw new AppError("EXTERNAL_SERVICE_ERROR","Outbox event recipient was not found.");
    const occurredAt=event.createdAt.toISOString(), recipient={email:String(row.Email),name:String(row.FullName??"")};
    if(event.eventType==="ReservationCreated"){
      if(!row.Reference||!row.ExpiresAt) throw new AppError("EXTERNAL_SERVICE_ERROR","Reservation notification data was incomplete.");
      const items=await this.db.query<Row>("SELECT CONCAT(p.ProductName,N' - ',v.VariantName) Name,ri.Quantity FROM dbo.ReservationItems ri JOIN dbo.ProductVariants v ON v.ProductVariantId=ri.ProductVariantId JOIN dbo.Products p ON p.ProductId=v.ProductId WHERE ri.ReservationId=@id ORDER BY ri.ReservationItemId",{id:Number(event.aggregateId)});
      return {eventId:event.eventId,eventType:"ReservationCreated",occurredAt,recipient,data:{reservationReference:String(row.Reference),itemSummary:items.map((item)=>`${Number(item.Quantity)}x ${String(item.Name)}`).join(", "),expiresAt:new Date(row.ExpiresAt as string|Date).toISOString(),pickupLocation:"NU Fairview Campus"}};
    }
    if(event.eventType==="ReservationReady"&&row.Reference) return {eventId:event.eventId,eventType:"ReservationReady",occurredAt,recipient,data:{reservationReference:String(row.Reference),readyAt:occurredAt,pickupLocation:"NU Fairview Campus"}};
    if(event.eventType==="QueueCalled"&&row.QueueNumber&&row.QueueTypeName&&row.Reference) return {eventId:event.eventId,eventType:"QueueCalled",occurredAt,recipient,data:{queueNumber:String(row.QueueNumber),queueType:String(row.QueueTypeName),reservationReference:String(row.Reference)}};
    if(event.eventType==="TransactionCompleted"&&row.TransactionReference&&row.Reference&&row.TotalAmount!=null) return {eventId:event.eventId,eventType:"TransactionCompleted",occurredAt,recipient,data:{transactionReference:String(row.TransactionReference),reservationReference:String(row.Reference),totalAmount:Number(row.TotalAmount),completedAt:occurredAt}};
    if(event.eventType==="ReservationCancelled"&&row.Reference) return {eventId:event.eventId,eventType:"ReservationCancelled",occurredAt,recipient,data:{reservationReference:String(row.Reference),cancelledAt:occurredAt}};
    throw new AppError("EXTERNAL_SERVICE_ERROR","Outbox notification data was incomplete.");
  }

  async dispatchBatch(limit?: number) {
    const events=await this.claimBatch(limit), max=positive(process.env.OUTBOX_MAX_ATTEMPTS,5,20); let delivered=0,failed=0,deadLetter=0;
    for(const event of events){const started=Date.now(); try{await this.automation.notifyEvent(await this.notification(event)); await this.db.query("UPDATE dbo.AutomationOutbox SET Status=N'Delivered',DeliveredAt=SYSUTCDATETIME(),LockedAt=NULL,LastError=NULL WHERE AutomationEventId=@id AND Status=N'Processing'",{id:event.id}); delivered++; this.log({eventId:event.eventId,eventType:event.eventType,attempt:event.attempt,status:"Delivered",duration:Date.now()-started});}catch(error){const dead=event.attempt>=max; await this.db.query("UPDATE dbo.AutomationOutbox SET Status=@status,NextAttemptAt=CASE WHEN @dead=1 THEN NULL ELSE DATEADD(second,@delay,SYSUTCDATETIME()) END,LockedAt=NULL,LastError=@error WHERE AutomationEventId=@id AND Status=N'Processing'",{id:event.id,status:dead?"DeadLetter":"Pending",dead,delay:delaySeconds(event.attempt),error:safeError(error)}); dead?deadLetter++:failed++; this.log({eventId:event.eventId,eventType:event.eventType,attempt:event.attempt,status:dead?"DeadLetter":"Pending",duration:Date.now()-started});}}
    return {claimed:events.length,delivered,failed,deadLetter};
  }

  async health(){const rows=await this.db.query<Row>("SELECT Status,COUNT(*) Count,MIN(CASE WHEN Status=N'Pending' THEN CreatedAt END) OldestPendingAt FROM dbo.AutomationOutbox GROUP BY Status"); const counts={Pending:0,Processing:0,Delivered:0,DeadLetter:0}; let oldestPendingAt:string|null=null; for(const row of rows){if(String(row.Status) in counts) counts[String(row.Status) as keyof typeof counts]=Number(row.Count); if(row.OldestPendingAt) oldestPendingAt=new Date(row.OldestPendingAt as string|Date).toISOString();} return {...counts,oldestPendingAt};}
  deadLetters(){return this.db.query<Row>("SELECT EventId,EventType,AggregateType,AggregateId,Attempts,CreatedAt,LastError FROM dbo.AutomationOutbox WHERE Status=N'DeadLetter' ORDER BY CreatedAt");}
  async retryDeadLetter(eventId:string){const rows=await this.db.query<Row>("UPDATE dbo.AutomationOutbox SET Status=N'Pending',Attempts=0,NextAttemptAt=SYSUTCDATETIME(),LockedAt=NULL WHERE EventId=@eventId AND Status=N'DeadLetter'; SELECT @@ROWCOUNT Updated",{eventId}); if(Number(rows[0]?.Updated)!==1) throw new AppError("NOT_FOUND","Dead-letter event not found."); return {eventId,status:"Pending"};}
}
