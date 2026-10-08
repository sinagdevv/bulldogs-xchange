import assert from "node:assert/strict";
import {PostgresConnectionManager,PostgresRollbackTestManager} from "../dist/src/integrations/postgres.js";
import {OutboxDispatcher} from "../dist/src/services/outbox-dispatcher.js";
import {SqlAdminService} from "../dist/src/services/sql-admin-service.js";
import {SqlBusinessService} from "../dist/src/services/sql-business-service.js";

const marker=`bx-int-${Date.now()}-${process.pid}`;
const emails={customer:"bx-integration-customer@example.test",staff:"bx-integration-staff@example.test",admin:"bx-integration-admin@example.test"};
const manager=new PostgresRollbackTestManager(),outside=new PostgresConnectionManager();
const snapshot=async()=>await outside.query(`SELECT
  (SELECT COUNT(*) FROM dbo.Users) users,(SELECT COUNT(*) FROM dbo.Categories) categories,
  (SELECT COUNT(*) FROM dbo.Products) products,(SELECT COUNT(*) FROM dbo.ProductVariants) variants,
  (SELECT COUNT(*) FROM dbo.Reservations) reservations,(SELECT COUNT(*) FROM dbo.Transactions) transactions,
  (SELECT COUNT(*) FROM dbo.QueueEntries) queues,(SELECT COUNT(*) FROM dbo.InventoryMovements) movements,
  (SELECT COUNT(*) FROM dbo.AuditLogs) audits,(SELECT COUNT(*) FROM dbo.AutomationOutbox) outbox,
  (SELECT COALESCE(SUM(PhysicalQuantity),0) FROM dbo.Inventory) physical,
  (SELECT COALESCE(SUM(ReservedQuantity),0) FROM dbo.Inventory) reserved,
  (SELECT SettingValue FROM dbo.SystemSettings WHERE SettingKey='ReferenceCounter') reference_counter`);
const code=(expected)=>error=>error?.code===expected;

try{
  const before=(await snapshot())[0],results={};
  await assert.rejects(()=>manager.rollback(db=>new SqlAdminService(db).createCategory({name:`${marker}-failed`},{id:"2147483647",email:"invalid@example.invalid",displayName:"Invalid",role:"Admin",isActive:true})));
  assert.equal(Number((await outside.query("SELECT COUNT(*) count FROM dbo.Categories WHERE CategoryName=@name",{name:`${marker}-failed`}))[0].count),0);
  await manager.rollback(async db=>{
    const inserted=await db.query(`INSERT dbo.Users(SchoolId,FullName,Email,RoleId,CustomerType)
      SELECT @customerSchool,'BX Integration Customer',@customerEmail,RoleId,'Student' FROM dbo.Roles WHERE RoleName='Customer';
      INSERT dbo.Users(SchoolId,FullName,Email,RoleId) SELECT @staffSchool,'BX Integration Staff',@staffEmail,RoleId FROM dbo.Roles WHERE RoleName='Staff';
      INSERT dbo.Users(SchoolId,FullName,Email,RoleId) SELECT @adminSchool,'BX Integration Admin',@adminEmail,RoleId FROM dbo.Roles WHERE RoleName='Admin';
      SELECT UserId,FullName,Email,RoleName FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE Email IN(@customerEmail,@staffEmail,@adminEmail) ORDER BY UserId`,{
        customerSchool:`BX-C-${marker}`,staffSchool:`BX-S-${marker}`,adminSchool:`BX-A-${marker}`,
        ...Object.fromEntries(Object.entries(emails).map(([key,value])=>[`${key}Email`,value]))
      });
    assert.equal(inserted.length,3);
    const user=(role)=>{const row=inserted.find(x=>x.RoleName===role);assert.ok(row);return{id:String(row.UserId),email:String(row.Email),displayName:String(row.FullName),role,isActive:true};};
    const customer=user("Customer"),staff=user("Staff"),admin=user("Admin");
    results.identities={customer,staff,admin};
    assert.equal(Number((await db.query("SELECT COUNT(*) count FROM dbo.Users WHERE Email IN(@customer,@staff,@admin)",emails))[0].count),3);

    const adminService=new SqlAdminService(db),business=new SqlBusinessService(db);
    const category=await adminService.createCategory({name:`${marker}-category`},admin);
    await adminService.updateCategory(category.id,{name:`${marker}-category-updated`},admin);
    await adminService.setCategoryActive(category.id,{isActive:false},admin);
    await adminService.setCategoryActive(category.id,{isActive:true},admin);
    const product=await adminService.createProduct({categoryId:category.id,name:"Integration Product",sku:`${marker}-sku`,price:125},admin);
    await assert.rejects(()=>adminService.createProduct({categoryId:category.id,name:"Duplicate",sku:`${marker}-sku`,price:1},admin),code("CONFLICT"));
    await adminService.updateProduct(product.id,{name:"Integration Product Updated"},admin);
    await adminService.setProductActive(product.id,{isActive:false},admin);
    await adminService.setProductActive(product.id,{isActive:true},admin);
    const variant=await adminService.createVariant({productId:product.id,name:"Standard",variantSku:`${marker}-variant`},admin);
    assert.deepEqual(await db.query("SELECT PhysicalQuantity,ReservedQuantity FROM dbo.Inventory WHERE ProductVariantId=@id",{id:Number(variant.id)}),[{PhysicalQuantity:0,ReservedQuantity:0}]);
    await adminService.updateVariant(variant.id,{name:"Standard Updated"},admin);
    await adminService.setVariantActive(variant.id,{isActive:false},admin);
    await adminService.setVariantActive(variant.id,{isActive:true},admin);
    await adminService.changeUserRole(customer.id,{role:"Staff"},admin);
    await adminService.changeUserRole(customer.id,{role:"Customer"},admin);
    await assert.rejects(()=>adminService.changeUserRole(admin.id,{role:"Staff"},admin),code("LAST_ADMIN_PROTECTED"));
    const expiry=(await db.query("SELECT SettingValue value FROM dbo.SystemSettings WHERE SettingKey='ReservationExpiryDays'"))[0];
    await adminService.updateSetting("ReservationExpiryDays",{value:Number(expiry.value)+1},admin);
    assert.throws(()=>adminService.updateSetting("ReferenceCounter",{value:999},admin),code("VALIDATION_ERROR"));
    results.admin=true;

    await business.restock({productVariantId:variant.id,quantity:20,reason:"Integration stock"},staff,`${marker}-restock`);
    assert.equal((await business.restock({productVariantId:variant.id,quantity:20},staff,`${marker}-restock`)).idempotent,true);
    const cancelled=await business.createReservation({items:[{productVariantId:variant.id,quantity:2}]},customer,`${marker}-cancel`);
    await business.cancelReservation(cancelled.id,customer);
    const cancelledEvents=await db.query("SELECT EventType,Status FROM dbo.AutomationOutbox WHERE AggregateId=@id ORDER BY AutomationEventId",{id:cancelled.id});
    assert.deepEqual(cancelledEvents.map(x=>[x.EventType,x.Status]),[["ReservationCreated","Superseded"],["ReservationCancelled","Pending"]]);

    const reservation=await business.createReservation({items:[{productVariantId:variant.id,quantity:3}]},customer,`${marker}-reservation`);
    assert.equal((await business.createReservation({items:[{productVariantId:variant.id,quantity:3}]},customer,`${marker}-reservation`)).idempotent,true);
    await business.transitionReservation(reservation.id,"Pending","Confirmed",staff);
    await business.transitionReservation(reservation.id,"Confirmed","Preparing",staff);
    await business.transitionReservation(reservation.id,"Preparing","Ready for Pickup",staff);
    const queue=await business.joinQueue({reservationId:reservation.id,queueType:"Regular"},customer);
    await business.queueAction({queueId:queue.id,action:"call"},staff);
    const sale=await business.processTransaction({reservationId:reservation.id,paymentMethod:"Cash"},staff,`${marker}-sale`);
    assert.equal((await business.processTransaction({reservationId:reservation.id,paymentMethod:"Cash"},staff,`${marker}-sale`)).idempotent,true);
    const inventory=(await db.query("SELECT PhysicalQuantity,ReservedQuantity FROM dbo.Inventory WHERE ProductVariantId=@id",{id:Number(variant.id)}))[0];
    assert.deepEqual(inventory,{PhysicalQuantity:17,ReservedQuantity:0});
    assert.ok(Number((await db.query("SELECT COUNT(*) count FROM dbo.AuditLogs WHERE UserId IN(@customer,@staff,@admin)",{customer:Number(customer.id),staff:Number(staff.id),admin:Number(admin.id)}))[0].count)>0);
    results.business={reservation,queue,sale};

    const dispatcher=new OutboxDispatcher(db,{notifyEvent:async()=>{throw new Error("synthetic delivery failure");}},()=>{});
    const claimable=(await db.query("SELECT EventId FROM dbo.AutomationOutbox WHERE Status='Pending' ORDER BY AutomationEventId LIMIT 1"))[0];
    assert.ok(claimable);
    const claimed=await dispatcher.claimEvent(String(claimable.EventId));
    assert.ok(claimed);
    assert.equal(await dispatcher.claimEvent(String(claimable.EventId)),undefined);
    await db.query("UPDATE dbo.AutomationOutbox SET Status='Pending',Attempts=0,LockedAt=NULL WHERE AutomationEventId=@id",{id:claimed.id});
    const retry=await dispatcher.dispatchEvent(String(claimable.EventId));
    assert.equal(retry.status,"Pending");
    assert.equal(Number((await db.query("SELECT Attempts FROM dbo.AutomationOutbox WHERE AutomationEventId=@id",{id:claimed.id}))[0].Attempts),1);
    results.outbox=true;

    assert.equal(Number((await db.query("SELECT COUNT(*) count FROM dbo.Users WHERE Email IN(@customer,@staff,@admin)",emails))[0].count),3);
    assert.equal(Number((await db.query("SELECT COUNT(*) count FROM dbo.Categories WHERE CategoryName LIKE @marker",{marker:`${marker}%`}))[0].count),1);
  });

  const after=(await snapshot())[0];
  assert.deepEqual(after,before);
  assert.equal(Number((await outside.query("SELECT COUNT(*) count FROM dbo.Users WHERE Email IN(@customer,@staff,@admin)",emails))[0].count),0);
  assert.equal(Number((await outside.query("SELECT COUNT(*) count FROM dbo.Categories WHERE CategoryName LIKE @marker",{marker:`${marker}%`}))[0].count),0);
  console.log(JSON.stringify({testIdentities:"PASS",sharedClient:"PASS",successfulServiceRollback:"PASS",failedServiceRollback:"PASS",adminWorkflows:results.admin?"PASS":"FAIL",businessWorkflows:results.business?"PASS":"FAIL",outbox:results.outbox?"PASS":"FAIL",permanentRecords:"NONE",stateRestored:"PASS",externalNotifications:"NONE"},null,2));
}finally{await manager.closePool();await outside.closePool();}
