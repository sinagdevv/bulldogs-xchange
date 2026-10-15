import {randomUUID} from "node:crypto";
import {PostgresConnectionManager} from "../dist/src/integrations/postgres.js";
import {mapUser} from "../dist/src/repositories/sql-server-repository.js";
import {OutboxDispatcher} from "../dist/src/services/outbox-dispatcher.js";
import {SqlBusinessService} from "../dist/src/services/sql-business-service.js";
import {UserProvisioningService} from "../dist/src/services/user-provisioning-service.js";

const args=Object.fromEntries(process.argv.slice(2).map(value=>{const [key,...rest]=value.replace(/^--/,"").split("=");return[key,decodeURIComponent(rest.join("="))]})),email=args.email?.trim().toLowerCase(),schoolId=args["school-id"]?.trim(),fullName=args.name?.trim(),variantId=Number(args["variant-id"]),approval=args.approve?.trim();
if(!email||!schoolId||!fullName||!Number.isInteger(variantId)||variantId<=0||approval!==`SEND ONE RESERVATION TEST TO ${email}`)throw new Error('Required: --email, --school-id, --name, --variant-id, and --approve="SEND ONE RESERVATION TEST TO <email>".');
if(process.env.DATA_PROVIDER!=="supabase"||!process.env.PA_NOTIFY_EVENT_URL||!process.env.BX_AUTOMATION_SECRET)throw new Error("Supabase and Power Automate live-test configuration is incomplete.");
const db=new PostgresConnectionManager(),mask=value=>{const [local,domain]=value.split("@");return `${local.slice(0,2)}***${local.slice(-1)}@${domain}`};
try{
  let row=(await db.query("SELECT u.UserId,u.SchoolId,u.FullName,u.Email,r.RoleName,u.CustomerType,u.IsActive FROM dbo.Users u JOIN dbo.Roles r ON r.RoleId=u.RoleId WHERE LOWER(u.Email)=LOWER(@email)",{email}))[0],user;
  if(row){user=mapUser(row);if(!user.isActive||user.role!=="Customer")throw new Error("The selected identity is not an active Customer.");}
  else user=await new UserProvisioningService(db).registerCustomer({subject:"trusted-live-validation",email},{schoolId,fullName,customerType:"Integration Test"});
  const reservation=await new SqlBusinessService(db).createReservation({items:[{productVariantId:variantId,quantity:1}]},user,`live-notification-${randomUUID()}`);
  const events=await db.query("SELECT EventId FROM dbo.AutomationOutbox WHERE EventType='ReservationCreated' AND AggregateType='Reservation' AND AggregateId=@id AND Status='Pending'",{id:reservation.id});
  if(events.length!==1)throw new Error("Exactly one pending ReservationCreated event was not found.");
  const eventId=String(events[0].EventId),dispatch=await new OutboxDispatcher(db).dispatchEvent(eventId),state=(await db.query("SELECT Status,Attempts,DeliveredAt FROM dbo.AutomationOutbox WHERE EventId=@eventId",{eventId}))[0];
  console.log(JSON.stringify({recipient:mask(email),reservationReference:reservation.reference,eventId,httpAccepted:dispatch.delivered===1,outboxState:state?.Status,attempts:Number(state?.Attempts)},null,2));
  if(dispatch.delivered!==1||state?.Status!=="Delivered")process.exitCode=1;
}catch(error){console.error(error instanceof Error?error.message:"Live validation failed.");process.exitCode=1;}finally{await db.closePool();}
