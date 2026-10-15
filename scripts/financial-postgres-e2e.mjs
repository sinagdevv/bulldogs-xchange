import assert from "node:assert/strict";

const url=process.env.FINANCIAL_STAGING_DATABASE_URL,operational="miwodndxgrdyanrloxig";
if(!url||process.env.FINANCIAL_STAGING_CONFIRM!=="DISPOSABLE")throw new Error("Disposable financial staging configuration is required.");
if(url===process.env.SUPABASE_DATABASE_URL||url.includes(operational))throw new Error("Refusing the operational Supabase project.");
process.env.SUPABASE_DATABASE_URL=url;process.env.POSTGRES_SSL="false";process.env.ENABLE_DEPOSIT_WORKFLOW="true";process.env.PAYMENT_EVIDENCE_SECRET="local-disposable-evidence-secret-only";

const [{PostgresConnectionManager,PostgresRollbackTestManager},{SqlBusinessService},{DepositService},{FinancialReportingService},{signEvidenceReceipt}]=await Promise.all([import("../dist/src/integrations/postgres.js"),import("../dist/src/services/sql-business-service.js"),import("../dist/src/services/deposit-service.js"),import("../dist/src/services/financial-reporting-service.js"),import("../dist/src/services/payment-evidence.js")]);
const outside=new PostgresConnectionManager(),manager=new PostgresRollbackTestManager(),evidence={fileName:"fictional.pdf",contentType:"application/pdf",size:32,sha256:"a".repeat(64),storageObjectId:"fictional/staging/evidence"};
const count=async db=>(await db.query("SELECT (SELECT count(*) FROM dbo.reservations) Reservations,(SELECT count(*) FROM dbo.transactions) Transactions,(SELECT count(*) FROM dbo.reservationdeposits) Deposits,(SELECT count(*) FROM dbo.depositrefunds) Refunds,(SELECT COALESCE(sum(reservedquantity),0) FROM dbo.inventory) Reserved"))[0];
try{
  const before=await count(outside),results={};
  await manager.rollback(async db=>{
    await db.query("INSERT dbo.CounterOperatingHours(Weekday,OpensAt,ClosesAt,IsOpen) SELECT n,'00:00','23:59',true FROM generate_series(0,6) n ON CONFLICT(Weekday) DO UPDATE SET OpensAt='00:00',ClosesAt='23:59',IsOpen=true");
    const emails={customer:"customer@example.test",staff1:"staff@example.test",admin:"admin@example.test",staff2:"fictional-staff-2@example.test"};
    await db.query("INSERT dbo.Users(SchoolId,FullName,Email,RoleId) SELECT N'FICTIONAL-STAFF-2',N'Fictional Staff Two',@staff2,RoleId FROM dbo.Roles WHERE RoleName=N'Staff' ON CONFLICT DO NOTHING",emails);
    const users=await db.query("SELECT u.UserId,u.Email,r.RoleName FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE u.Email IN(@customer,@staff1,@admin,@staff2)",emails);
    const actor=(email,role)=>{const row=users.find(x=>x.Email===email);assert.ok(row);return{id:String(row.UserId),email,displayName:email,role,isActive:true}};
    const customer=actor(emails.customer,"Customer"),staff1=actor(emails.staff1,"Staff"),staff2=actor(emails.staff2,"Staff"),admin=actor(emails.admin,"Admin"),evidenceToken=reservationId=>signEvidenceReceipt({...evidence,storageObjectId:`${customer.id}/${reservationId}/fictional`,scanStatus:"clean",ownerId:customer.id,reservationId:String(reservationId),uploadedAt:new Date().toISOString()});
    const variant=(await db.query("SELECT ProductVariantId FROM dbo.ProductVariants WHERE VariantSKU=N'DEMO-SHIRT-M'"))[0];assert.ok(variant);
    const business=new SqlBusinessService(manager),deposits=new DepositService(manager);

    const gcash=await business.createReservation({items:[{productVariantId:variant.ProductVariantId,quantity:1}],paymentMethod:"GCash"},customer,"staging-gcash");
    const gcashDeposit=(await db.query("SELECT ReservationDepositId FROM dbo.ReservationDeposits WHERE ReservationId=@id",{id:Number(gcash.id)}))[0];
    await deposits.submit(Number(gcash.id),{amountReceived:"200.00",paymentMethod:"GCash",paymentReference:"STAGING-GCASH-1",evidenceToken:evidenceToken(gcash.id)},customer);
    await deposits.decide(Number(gcashDeposit.ReservationDepositId),true,{},staff1);
    await business.transitionReservation(gcash.id,"Confirmed","Preparing",staff1);await business.transitionReservation(gcash.id,"Preparing","Ready for Pickup",staff1);
    const sale=await business.processTransaction({reservationId:gcash.id,paymentMethod:"Cash",amountCollected:"150.00",receiptReference:"STAGING-BALANCE-1"},staff1,"staging-sale");
    assert.equal(sale.totalAmount,350);assert.equal((await business.processTransaction({reservationId:gcash.id,paymentMethod:"Cash",amountCollected:"150.00",receiptReference:"STAGING-BALANCE-1"},staff1,"staging-sale")).idempotent,true);results.gcash="PASS";

    const cash=await business.createReservation({items:[{productVariantId:variant.ProductVariantId,quantity:1}],paymentMethod:"Cash"},customer,"staging-cash");
    const cashDeposit=(await db.query("SELECT ReservationDepositId FROM dbo.ReservationDeposits WHERE ReservationId=@id",{id:Number(cash.id)}))[0];
    await deposits.collectCash(Number(cashDeposit.ReservationDepositId),{amountReceived:"200.00",receiptReference:"STAGING-CASH-1",collectedAt:new Date()},staff1);
    await assert.rejects(()=>deposits.decide(Number(cashDeposit.ReservationDepositId),true,{},staff1));await deposits.decide(Number(cashDeposit.ReservationDepositId),true,{},staff2);results.cash="PASS";

    const refundable=await business.createReservation({items:[{productVariantId:variant.ProductVariantId,quantity:1}],paymentMethod:"GCash"},customer,"staging-refund");
    const refundDeposit=(await db.query("SELECT ReservationDepositId FROM dbo.ReservationDeposits WHERE ReservationId=@id",{id:Number(refundable.id)}))[0];
    await deposits.submit(Number(refundable.id),{amountReceived:"200.00",paymentMethod:"GCash",paymentReference:"STAGING-GCASH-REFUND",evidenceToken:evidenceToken(refundable.id)},customer);await deposits.decide(Number(refundDeposit.ReservationDepositId),true,{},staff1);await business.cancelReservation(refundable.id,customer);
    const refund=(await db.query("SELECT DepositRefundId FROM dbo.DepositRefunds WHERE ReservationDepositId=@id",{id:Number(refundDeposit.ReservationDepositId)}))[0];
    await deposits.decideRefund(Number(refund.DepositRefundId),{approve:true,reason:"Eligible fictional cancellation"},staff1);await deposits.recordRefundPayout(Number(refund.DepositRefundId),{refundReference:"STAGING-REFUND-1",evidence},staff2);await deposits.completeRefund(Number(refund.DepositRefundId),admin);
    assert.equal((await db.query("SELECT RefundStatus FROM dbo.DepositRefunds WHERE DepositRefundId=@id",{id:Number(refund.DepositRefundId)}))[0].RefundStatus,"Refund Completed");results.refund="PASS";
    const overview=await new FinancialReportingService(db).overview({});assert.equal(String(overview.completedSales),"350.00");assert.equal(String(overview.pickupCollections),"150.00");results.reconciliation="PASS";
    await assert.rejects(()=>deposits.get(Number(cash.id),{...customer,id:"2147483647"}));results.security="PASS";
  });
  assert.deepEqual(await count(outside),before);console.log(JSON.stringify({...results,rollback:"PASS",permanentFinancialRecords:"NONE",externalPayments:"NONE",externalNotifications:"NONE"},null,2));
}finally{await manager.closePool();await outside.closePool();}
