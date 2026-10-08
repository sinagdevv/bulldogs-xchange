import assert from "node:assert/strict";
import { SqlServerConnectionManager } from "../dist/src/integrations/sql-server.js";
import { SqlBusinessService } from "../dist/src/services/sql-business-service.js";
import { OutboxDispatcher } from "../dist/src/services/outbox-dispatcher.js";

const db = new SqlServerConnectionManager();
const query = (sql, params = {}) => db.query(sql, params);
const iso = (value) => value == null ? null : new Date(value).toISOString();

async function snapshot() {
  const reservation = await query(`SELECT r.ReservationId,r.Reference,r.CustomerId,u.FullName,u.Email,s.StatusName
    FROM dbo.Reservations r JOIN dbo.Users u ON u.UserId=r.CustomerId
    JOIN dbo.ReservationStatuses s ON s.ReservationStatusId=r.ReservationStatusId WHERE r.ReservationId=13`);
  const items = await query(`SELECT ri.ProductVariantId,CONCAT(p.ProductName,N' - ',v.VariantName) Product,ri.Quantity,ri.UnitPrice
    FROM dbo.ReservationItems ri JOIN dbo.ProductVariants v ON v.ProductVariantId=ri.ProductVariantId
    JOIN dbo.Products p ON p.ProductId=v.ProductId WHERE ri.ReservationId=13`);
  const queues = await query(`SELECT q.QueueEntryId,q.QueueNumber,qt.QueueTypeName,qs.StatusName,q.CalledAt,q.CompletedAt
    FROM dbo.QueueEntries q JOIN dbo.QueueTypes qt ON qt.QueueTypeId=q.QueueTypeId
    JOIN dbo.QueueStatuses qs ON qs.QueueStatusId=q.QueueStatusId WHERE q.ReservationId=13`);
  const inventory = (await query(`SELECT PhysicalQuantity,ReservedQuantity,PhysicalQuantity-ReservedQuantity AvailableQuantity
    FROM dbo.Inventory WHERE ProductVariantId=1`))[0];
  const transactions = await query(`SELECT t.TransactionId,t.Reference TransactionReference,t.ReservationId,c.FullName Customer,c.Email CustomerEmail,
    s.FullName Staff,s.Email StaffEmail,ts.StatusName,pm.PaymentMethodName,t.TotalAmount,t.CreatedAt
    FROM dbo.Transactions t JOIN dbo.Users c ON c.UserId=t.CustomerId JOIN dbo.Users s ON s.UserId=t.StaffId
    JOIN dbo.TransactionStatuses ts ON ts.TransactionStatusId=t.TransactionStatusId
    LEFT JOIN dbo.PaymentMethods pm ON pm.PaymentMethodId=t.PaymentMethodId WHERE t.ReservationId=13`);
  const transactionItems = transactions.length ? await query(`SELECT ti.TransactionItemId,ti.ProductVariantId,CONCAT(p.ProductName,N' - ',v.VariantName) Product,
    ti.Quantity,ti.UnitPrice,ti.Quantity*ti.UnitPrice LineTotal FROM dbo.TransactionItems ti
    JOIN dbo.ProductVariants v ON v.ProductVariantId=ti.ProductVariantId JOIN dbo.Products p ON p.ProductId=v.ProductId
    WHERE ti.TransactionId=@id`, { id: Number(transactions[0].TransactionId) }) : [];
  const movements = await query(`SELECT m.InventoryMovementId,mt.MovementTypeName,m.PreviousQty,m.ChangeQty,m.ResultingQty,
    m.PreviousReservedQuantity,m.ResultingReservedQuantity,m.RelatedReference,u.FullName PerformedBy,u.Email PerformedByEmail,m.CreatedAt
    FROM dbo.InventoryMovements m JOIN dbo.InventoryMovementTypes mt ON mt.InventoryMovementTypeId=m.InventoryMovementTypeId
    LEFT JOIN dbo.Users u ON u.UserId=m.PerformedByUserId WHERE m.ProductVariantId=1 AND m.RelatedReference IN(N'BX-2026-0150',
    (SELECT Reference FROM dbo.Transactions WHERE ReservationId=13)) ORDER BY m.InventoryMovementId`);
  const outbox = await query(`SELECT AutomationEventId,CONVERT(nvarchar(36),EventId) EventId,EventType,AggregateType,AggregateId,Payload,Status,
    Attempts,CreatedAt,DeliveredAt,LastError FROM dbo.AutomationOutbox
    WHERE (AggregateType=N'Reservation' AND AggregateId=N'13') OR
      (AggregateType=N'QueueEntry' AND AggregateId=N'8') OR
      (AggregateType=N'Transaction' AND AggregateId IN(SELECT CONVERT(nvarchar(100),TransactionId) FROM dbo.Transactions WHERE ReservationId=13))
    ORDER BY AutomationEventId`);
  const audits = await query(`SELECT a.AuditLogId,a.Action,a.Entity,a.EntityId,u.FullName Actor,u.Email ActorEmail,a.CreatedAt
    FROM dbo.AuditLogs a LEFT JOIN dbo.Users u ON u.UserId=a.UserId
    WHERE (a.Entity=N'Transaction' AND a.EntityId IN(SELECT CONVERT(nvarchar(100),TransactionId) FROM dbo.Transactions WHERE ReservationId=13))
    ORDER BY a.AuditLogId`);
  const staff = await query(`SELECT TOP (1) u.UserId,u.FullName,u.Email,r.RoleName FROM dbo.Users u
    JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE u.IsActive=1 AND r.RoleName=N'Staff' ORDER BY u.UserId`);
  const payments = await query(`SELECT PaymentMethodName FROM dbo.PaymentMethods WHERE IsActive=1 ORDER BY PaymentMethodId`);
  const globalOutbox = await query(`SELECT Status,COUNT(*) Count FROM dbo.AutomationOutbox GROUP BY Status`);
  const consistency = (await query(`SELECT
    (SELECT COUNT(*) FROM dbo.Transactions WHERE ReservationId=13) TransactionCount,
    (SELECT COUNT(*) FROM dbo.TransactionItems WHERE TransactionId IN(SELECT TransactionId FROM dbo.Transactions WHERE ReservationId=13)) TransactionItemCount,
    (SELECT COUNT(*) FROM dbo.InventoryMovements WHERE RelatedReference IN(SELECT Reference FROM dbo.Transactions WHERE ReservationId=13) AND ProductVariantId=1 AND InventoryMovementTypeId=(SELECT InventoryMovementTypeId FROM dbo.InventoryMovementTypes WHERE MovementTypeName=N'Sale')) SaleCount,
    (SELECT COUNT(*) FROM dbo.AutomationOutbox WHERE EventType=N'TransactionCompleted' AND AggregateId IN(SELECT CONVERT(nvarchar(100),TransactionId) FROM dbo.Transactions WHERE ReservationId=13)) TransactionCompletedCount,
    (SELECT COUNT(*) FROM dbo.Inventory WHERE PhysicalQuantity<0 OR ReservedQuantity<0 OR ReservedQuantity>PhysicalQuantity) NegativeInventoryCount,
    (SELECT COUNT(*) FROM dbo.TransactionItems ti LEFT JOIN dbo.Transactions t ON t.TransactionId=ti.TransactionId WHERE t.TransactionId IS NULL) OrphanTransactionItems,
    (SELECT COUNT(*) FROM dbo.AutomationOutbox WHERE Status=N'Pending' AND NOT(EventType=N'TransactionCompleted' AND AggregateId IN(SELECT CONVERT(nvarchar(100),TransactionId) FROM dbo.Transactions WHERE ReservationId=13))) UnexpectedPendingCount,
    (SELECT COUNT(*) FROM dbo.AutomationOutbox WHERE Status=N'DeadLetter') DeadLetterCount`))[0];
  return { reservation, items, queues, inventory, transactions, transactionItems, movements, outbox, audits, staff, payments, globalOutbox, consistency };
}

function assertPreflight(s) {
  assert.equal(s.reservation.length, 1); assert.deepEqual(s.reservation[0], { ReservationId:13, Reference:"BX-2026-0150", CustomerId:4, FullName:"John Ray P. Cacananta", Email:"cacanantajrp@students.nu-fairview.edu.ph", StatusName:"Ready for Pickup" });
  assert.equal(s.items.length, 1); assert.equal(Number(s.items[0].ProductVariantId), 1); assert.equal(Number(s.items[0].Quantity), 1); assert.equal(Number(s.items[0].UnitPrice), 350);
  assert.equal(s.queues.length, 1); assert.equal(Number(s.queues[0].QueueEntryId), 8); assert.equal(s.queues[0].QueueNumber, "R-0151"); assert.equal(s.queues[0].QueueTypeName, "Regular"); assert.equal(s.queues[0].StatusName, "Serving");
  assert.equal(s.transactions.length, 0); assert.equal(s.inventory.PhysicalQuantity, 20); assert.equal(s.inventory.ReservedQuantity, 3); assert.equal(s.inventory.AvailableQuantity, 17);
  assert.equal(s.outbox.filter(x => x.EventType === "TransactionCompleted").length, 0);
  assert.equal(s.outbox.find(x => x.EventType === "ReservationCreated")?.Status, "Delivered"); assert.equal(s.outbox.find(x => x.EventType === "ReservationReady")?.Status, "Delivered"); assert.equal(s.outbox.find(x => x.EventType === "QueueCalled")?.Status, "Delivered");
  assert.equal(s.globalOutbox.find(x => x.Status === "Pending")?.Count ?? 0, 0); assert.equal(s.staff.length, 1); assert.ok(s.payments.some(x => x.PaymentMethodName === "Cash"));
}

try {
  const before = await snapshot();
  if (process.argv.includes("--verify")) {
    assert.deepEqual(Object.values(before.consistency),[1,1,1,1,0,0,0,0]);
    assert.equal(before.reservation[0].StatusName,"Completed"); assert.equal(before.queues[0].StatusName,"Completed"); assert.deepEqual([before.inventory.PhysicalQuantity,before.inventory.ReservedQuantity,before.inventory.AvailableQuantity],[19,2,17]);
    console.log(JSON.stringify({ consistency:"PASS", state:before }, null, 2));
  } else {
    assertPreflight(before);
  if (!process.argv.includes("--execute")) { console.log(JSON.stringify({ preflight:"PASS", paymentMethod:"Cash", actor:before.staff[0], before }, null, 2)); process.exitCode=0; }
  else {
    const actor = { id:String(before.staff[0].UserId), fullName:String(before.staff[0].FullName), email:String(before.staff[0].Email), role:"Staff", isActive:true };
    const result = await new SqlBusinessService(db).processTransaction({ reservationId:13, paymentMethod:"Cash" }, actor, "bx-2026-0150-transaction-validation");
    const after = await snapshot();
    assert.equal(after.transactions.length,1); assert.equal(after.transactionItems.length,1); assert.equal(after.reservation[0].StatusName,"Completed"); assert.equal(after.queues[0].StatusName,"Completed");
    assert.deepEqual([after.inventory.PhysicalQuantity,after.inventory.ReservedQuantity,after.inventory.AvailableQuantity],[19,2,17]);
    const tx=after.transactions[0], sale=after.movements.filter(x=>x.MovementTypeName==="Sale"&&x.RelatedReference===tx.TransactionReference), event=after.outbox.filter(x=>x.EventType==="TransactionCompleted");
    assert.equal(Number(tx.TotalAmount),350); assert.equal(after.transactionItems[0].LineTotal,350); assert.equal(sale.length,1); assert.equal(event.length,1); assert.equal(event[0].Status,"Pending"); assert.equal(event[0].Attempts,0); assert.equal(event[0].DeliveredAt,null); assert.equal(event[0].LastError,null);
    const notification = await new OutboxDispatcher(db).notification({ id:Number(event[0].AutomationEventId), eventId:event[0].EventId, eventType:event[0].EventType, aggregateType:event[0].AggregateType, aggregateId:event[0].AggregateId, payload:JSON.parse(event[0].Payload), attempt:event[0].Attempts, createdAt:new Date(event[0].CreatedAt) });
    assert.equal(JSON.parse(JSON.stringify(notification)).data.totalAmount,350);
    console.log(JSON.stringify({ preflight:"PASS", method:"SqlBusinessService.processTransaction", input:{reservationId:13,paymentMethod:"Cash"}, actor, result, before:{inventory:before.inventory,movementCount:before.movements.length}, after, outboundPayload:notification, serialization:"PASS" }, (_key,value)=>value instanceof Date?value.toISOString():value, 2));
  }
  }
} finally { await db.closePool(); }
