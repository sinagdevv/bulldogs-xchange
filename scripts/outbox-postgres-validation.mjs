import assert from "node:assert/strict";
import {PostgresConnectionManager,PostgresRollbackTestManager} from "../dist/src/integrations/postgres.js";
import {OutboxDispatcher} from "../dist/src/services/outbox-dispatcher.js";

const connection=new PostgresConnectionManager(),manager=new PostgresRollbackTestManager(connection),marker=`BX-OUTBOX-${Date.now()}`;
try{
  await manager.rollback(async db=>{
    const user=(await db.query("INSERT dbo.Users(SchoolId,FullName,Email,RoleId,CustomerType) OUTPUT INSERTED.UserId SELECT @schoolId,'Outbox Validation',@email,RoleId,'Test' FROM dbo.Roles WHERE RoleName='Customer'",{schoolId:marker,email:`${marker.toLowerCase()}@example.invalid`}))[0];
    const category=(await db.query("INSERT dbo.Categories(CategoryName) OUTPUT INSERTED.CategoryId VALUES(@name)",{name:marker}))[0];
    const product=(await db.query("INSERT dbo.Products(CategoryId,SKU,ProductName,Price) OUTPUT INSERTED.ProductId VALUES(@categoryId,@sku,'Validation Product',125.50)",{categoryId:category.CategoryId,sku:marker}))[0];
    const variant=(await db.query("INSERT dbo.ProductVariants(ProductId,VariantName,VariantSKU) OUTPUT INSERTED.ProductVariantId VALUES(@productId,'Default',@sku)",{productId:product.ProductId,sku:`${marker}-V`}))[0];
    await db.query("INSERT dbo.Inventory(ProductVariantId,PhysicalQuantity,ReservedQuantity) VALUES(@variantId,10,1)",{variantId:variant.ProductVariantId});
    const reservation=(await db.query("INSERT dbo.Reservations(Reference,CustomerId,ReservationStatusId,ExpiresAt) OUTPUT INSERTED.ReservationId SELECT @reference,@userId,ReservationStatusId,CURRENT_TIMESTAMP+INTERVAL '1 day' FROM dbo.ReservationStatuses WHERE StatusName='Ready for Pickup'",{reference:marker,userId:user.UserId}))[0];
    await db.query("INSERT dbo.ReservationItems(ReservationId,ProductVariantId,Quantity,UnitPrice) VALUES(@reservationId,@variantId,1,125.50)",{reservationId:reservation.ReservationId,variantId:variant.ProductVariantId});
    const queue=(await db.query("INSERT dbo.QueueEntries(QueueNumber,CustomerId,ReservationId,QueueTypeId,QueueStatusId) OUTPUT INSERTED.QueueEntryId SELECT 'T-001',@userId,@reservationId,t.QueueTypeId,s.QueueStatusId FROM dbo.QueueTypes t CROSS JOIN dbo.QueueStatuses s WHERE t.QueueTypeName='Regular' AND s.StatusName='Serving'",{userId:user.UserId,reservationId:reservation.ReservationId}))[0];
    const transaction=(await db.query("INSERT dbo.Transactions(Reference,ReservationId,CustomerId,StaffId,PaymentMethodId,TransactionStatusId,TotalAmount) OUTPUT INSERTED.TransactionId SELECT @reference,@reservationId,@userId,@userId,p.PaymentMethodId,s.TransactionStatusId,125.50 FROM dbo.PaymentMethods p CROSS JOIN dbo.TransactionStatuses s WHERE p.PaymentMethodName='Cash' AND s.StatusName='Completed'",{reference:`${marker}-TX`,reservationId:reservation.ReservationId,userId:user.UserId}))[0];
    const definitions=[['ReservationCreated','Reservation',reservation.ReservationId],['ReservationReady','Reservation',reservation.ReservationId],['ReservationCancelled','Reservation',reservation.ReservationId],['QueueCalled','QueueEntry',queue.QueueEntryId],['TransactionCompleted','Transaction',transaction.TransactionId]];
    for(const [eventType,aggregateType,aggregateId] of definitions)await db.query("INSERT dbo.AutomationOutbox(EventType,AggregateType,AggregateId,Payload) VALUES(@eventType,@aggregateType,@aggregateId,@payload)",{eventType,aggregateType,aggregateId:String(aggregateId),payload:'{}'});
    await db.query("INSERT dbo.AutomationOutbox(EventType,AggregateType,AggregateId,Payload,Status,SupersededAt,SupersededReason) VALUES('ReservationCreated','Reservation',@aggregateId,'{}','Superseded',CURRENT_TIMESTAMP,'validation fixture')",{aggregateId:String(reservation.ReservationId)});
    const received=[],automation={notifyEvent:async event=>{received.push(event);return{success:true,eventId:event.eventId,message:'accepted'}}};
    const result=await new OutboxDispatcher(db,automation,()=>{}).dispatchBatch(20);
    assert.deepEqual(result,{claimed:5,delivered:5,failed:0,deadLetter:0});
    assert.deepEqual(new Set(received.map(x=>x.eventType)),new Set(definitions.map(x=>x[0])));
    for(const event of received){assert.match(event.eventId,/^[0-9a-f-]{36}$/i);assert.ok(!Number.isNaN(Date.parse(event.occurredAt)));assert.equal(typeof event.recipient.email,'string');assert.equal(typeof event.recipient.name,'string');assert.ok(Object.keys(event.data).length);assert.equal(JSON.stringify(event).includes('automationEventId'),false);}
    const statuses=await db.query("SELECT Status,COUNT(*) Count FROM dbo.AutomationOutbox WHERE AggregateId IN(@reservationId,@queueId,@transactionId) GROUP BY Status",{reservationId:String(reservation.ReservationId),queueId:String(queue.QueueEntryId),transactionId:String(transaction.TransactionId)});
    assert.equal(Number(statuses.find(x=>x.Status==='Delivered')?.Count),5);assert.equal(Number(statuses.find(x=>x.Status==='Superseded')?.Count),1);
    const retryEvents=await db.query("INSERT dbo.AutomationOutbox(EventType,AggregateType,AggregateId,Payload) VALUES('ReservationReady','Reservation',@id,'{}'),('ReservationReady','Reservation',@id,'{}') RETURNING EventId",{id:String(reservation.ReservationId)}),rejected=String(retryEvents[0].EventId),seen=[];
    const isolated=new OutboxDispatcher(db,{notifyEvent:async event=>{seen.push(event.eventId);if(event.eventId===rejected)throw new Error('rejected');return{success:true,eventId:event.eventId}}},()=>{});
    assert.deepEqual(await isolated.dispatchBatch(20),{claimed:2,delivered:1,failed:1,deadLetter:0});assert.equal(new Set(seen).size,2);assert.deepEqual(await isolated.dispatchBatch(20),{claimed:0,delivered:0,failed:0,deadLetter:0});
  });
  console.log('Supabase outbox rollback validation passed: 5 contracts, isolation, retry backoff, and supersession.');
}finally{await connection.closePool();}
