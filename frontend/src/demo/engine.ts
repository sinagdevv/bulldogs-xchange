import {createSeedState} from "./seed";
import {balanceFor,downPaymentFor,sanitizePolicy} from "./policy";
import {CATEGORIES,type Action,type DemoReservation,type DemoState,type ProductInput,type QueueEntry,type ResStatus,type Result,type AuditEvent,type AuditKind} from "./types";

/* ---------------- Rules ---------------- */
export const ACTIVE_STATUSES:ResStatus[]=["Pending Deposit","Pending","Confirmed","Preparing","Ready for Pickup"];
/** Allowed manual transitions. Completed is reachable only through "release" so stock is deducted exactly once. */
export const TRANSITIONS:Record<ResStatus,ResStatus[]>={
  "Pending Deposit":["Confirmed","Cancelled"],
  "Pending":["Confirmed","Cancelled"],"Confirmed":["Preparing","Cancelled"],"Preparing":["Ready for Pickup","Cancelled"],
  "Ready for Pickup":["Cancelled"],"Completed":[],"Cancelled":[],"Expired":[],
};
export const isActive=(s:ResStatus)=>ACTIVE_STATUSES.includes(s);
/** Students may only cancel before staff start preparing. */
export const STUDENT_CANCELLABLE:ResStatus[]=["Pending Deposit","Pending","Confirmed"];

/* ---------------- Selectors ---------------- */
/** Statuses where units are still waiting to be picked up (not completed, not cancelled, not expired). */
export const UNPICKED_STATUSES:ResStatus[]=ACTIVE_STATUSES;
export const studentOf=(s:DemoState,id:string)=>s.students.find(x=>x.id===id);
export const reservationOf=(s:DemoState,id:string)=>s.reservations.find(x=>x.id===id);
export const productOf=(s:DemoState,id:string)=>s.products.find(x=>x.id===id);
export const variantOf=(s:DemoState,id:string)=>s.variants.find(x=>x.id===id);
export const queueEntryFor=(s:DemoState,reservationId:string)=>s.queue.find(q=>q.reservationId===reservationId&&(q.status==="Waiting"||q.status==="Serving"));
export const totalOf=(x:DemoReservation)=>x.lines.reduce((sum,l)=>sum+l.qty*l.unitPrice,0);
export const unitsOf=(x:DemoReservation)=>x.lines.reduce((sum,l)=>sum+l.qty,0);

/** Reserved units are always derived from active reservations, so inventory can never drift from reservation state. */
export function stockOf(s:DemoState,variantId:string){
  const v=variantOf(s,variantId);if(!v)return{physical:0,reserved:0,available:0,reorder:0,status:"Out of Stock" as const};
  let reserved=0;for(const x of s.reservations)if(isActive(x.status))for(const l of x.lines)if(l.variantId===variantId)reserved+=l.qty;
  const available=v.physical-reserved,status=available<=0?"Out of Stock" as const:available<=v.reorder?"Low Stock" as const:"Healthy" as const;
  return{physical:v.physical,reserved,available,reorder:v.reorder,status};
}
export function productStock(s:DemoState,productId:string){
  const vs=s.variants.filter(v=>v.productId===productId),st=vs.map(v=>stockOf(s,v.id)),available=st.reduce((n,x)=>n+x.available,0);
  const status=st.every(x=>x.status==="Out of Stock")?"Out of Stock" as const:st.some(x=>x.status!=="Healthy")?"Low Stock" as const:"Healthy" as const;
  return{available,status};
}
export const unreadFor=(s:DemoState,studentId:string)=>s.notifications.filter(n=>n.studentId===studentId&&!n.read).length;
/** Units reserved and still awaiting pickup. Not the same as the number of unpicked reservations. */
export const unpickedUnits=(s:DemoState)=>s.reservations.filter(x=>UNPICKED_STATUSES.includes(x.status)).reduce((n,x)=>n+unitsOf(x),0);
export const unpickedReservations=(s:DemoState)=>s.reservations.filter(x=>UNPICKED_STATUSES.includes(x.status)).length;
/** Pickup status is derived from the reservation and its queue entry. It is separate from reservation status and payment status. */
export type PickupStatus="Not ready yet"|"Ready, not in queue"|"In queue"|"Called to counter"|"Picked up"|"Not applicable";
export function pickupStatusOf(s:DemoState,x:DemoReservation):PickupStatus{
  if(x.status==="Completed")return "Picked up";
  if(x.status==="Cancelled"||x.status==="Expired")return "Not applicable";
  if(x.status!=="Ready for Pickup")return "Not ready yet";
  const q=queueEntryFor(s,x.id);
  return q?(q.status==="Serving"?"Called to counter":"In queue"):"Ready, not in queue";
}
/** What the student still owes at pickup: the subtotal, minus the down payment only when it has been verified. */
export function balanceDueAtPickup(x:DemoReservation){
  const total=totalOf(x);return x.downPayment.status==="Verified"?balanceFor(total,x.downPayment.amount):total;
}
export function lineSummary(s:DemoState,x:DemoReservation){
  return x.lines.map(l=>{const v=variantOf(s,l.variantId),p=v&&productOf(s,v.productId);return `${p?.title??"Item"}${v&&v.name!=="Standard"?` (${v.name})`:""} x${l.qty}`}).join(", ");
}

/* ---------------- Engine ---------------- */
const fail=(state:DemoState,message:string):Result=>({state,ok:false,message});
const clone=(s:DemoState):DemoState=>({...s,counters:{...s.counters}});
const tick=(iso:string)=>new Date(Date.parse(iso)+3*60000).toISOString();
const pad=(n:number,w=4)=>String(n).padStart(w,"0");

function log(s:DemoState,kind:AuditKind,actor:string,message:string,ref?:string){
  const e:AuditEvent={id:`aud-${s.counters.audit++}`,at:s.now,kind,actor,message,...(ref?{ref}:{})};s.audit=[...s.audit,e];
}
function notify(s:DemoState,studentId:string,title:string,message:string,reservationId?:string){
  s.notifications=[...s.notifications,{id:`ntf-${s.counters.notification++}`,studentId,title,message,at:s.now,read:false,...(reservationId?{reservationId}:{})}];
}
function setStatus(s:DemoState,id:string,to:ResStatus,by:string,note?:string){
  s.reservations=s.reservations.map(x=>x.id===id?{...x,status:to,updatedAt:s.now,history:[...x.history,{status:to,at:s.now,by,...(note?{note}:{})}]}:x);
}
function closeQueue(s:DemoState,reservationId:string,to:QueueEntry["status"]){
  s.queue=s.queue.map(q=>q.reservationId===reservationId&&(q.status==="Waiting"||q.status==="Serving")?{...q,status:to,doneAt:s.now}:q);
}
const notice:Partial<Record<ResStatus,[string,string]>>={
  "Confirmed":["Reservation confirmed","Staff confirmed {ref}. We will start preparing it soon."],
  "Preparing":["Order being prepared","{ref} is being prepared at the Xchange counter."],
  "Ready for Pickup":["Ready for pickup","{ref} is ready. Bring your school ID and join the pickup queue."],
  "Completed":["Pickup completed","{ref} was picked up. Thank you, Bulldog!"],
  "Cancelled":["Reservation cancelled","{ref} was cancelled and its stock was released."],
};

export function applyAction(prev:DemoState,a:Action):Result{
  if(a.type==="reset")return{state:createSeedState(),ok:true,message:"Demo data restored to the original dataset."};
  const s=clone(prev);s.now=tick(prev.now);

  switch(a.type){
    case "reserve":{
      const st=studentOf(s,a.studentId),v=variantOf(s,a.variantId);
      if(!st)return fail(prev,"Student not found.");
      if(st.status!=="approved")return fail(prev,"Only approved students can reserve merchandise.");
      if(!v)return fail(prev,"That item is not available.");
      if(!Number.isInteger(a.qty)||a.qty<1)return fail(prev,"Choose a quantity of at least 1.");
      const pr=productOf(s,v.productId);if(!pr||!pr.active)return fail(prev,"This item is no longer available for reservation.");
      if(a.qty>s.settings.maxUnitsPerItem)return fail(prev,`Reservation limit reached. You can reserve up to ${s.settings.maxUnitsPerItem} unit${s.settings.maxUnitsPerItem===1?"":"s"} of this item.`);
      const avail=stockOf(prev,v.id).available;
      if(avail<=0)return fail(prev,"This size is out of stock.");
      if(a.qty>avail)return fail(prev,`Only ${avail} available for this size.`);
      const p=productOf(s,v.productId)!,id=`res-${s.counters.reservation}`,reference=`BX-DEMO-${pad(s.counters.reservation)}`;s.counters.reservation++;
      const x:DemoReservation={id,reference,studentId:st.id,lines:[{variantId:v.id,qty:a.qty,unitPrice:p.price}],status:"Pending",createdAt:s.now,updatedAt:s.now,expiresAt:new Date(Date.parse(s.now)+5*86400000).toISOString(),history:[{status:"Pending",at:s.now,by:st.name}],downPayment:{amount:downPaymentFor(a.qty*p.price,s.settings.downPaymentRate),rate:s.settings.downPaymentRate,status:"Awaiting payment",updatedAt:s.now}};
      s.reservations=[...s.reservations,x];
      log(s,"reservation",st.name,`Reserved ${reference} for ${st.name}`,id);
      notify(s,st.id,"Reservation received",`${reference} was received. Your down payment of ₱${x.downPayment.amount.toFixed(2)} is awaiting payment.`,id);
      return{state:s,ok:true,message:`${reference} reserved. Staff will confirm it shortly.`,created:id};
    }
    case "transition":{
      const x=reservationOf(s,a.reservationId);if(!x)return fail(prev,"Reservation not found.");
      if(a.to==="Completed")return fail(prev,"Use Release items to complete a pickup.");
      if(!TRANSITIONS[x.status].includes(a.to))return fail(prev,`A ${x.status.toLowerCase()} reservation cannot move to ${a.to}.`);
      if(a.role==="student"&&!(a.to==="Cancelled"&&STUDENT_CANCELLABLE.includes(x.status)))return fail(prev,"Staff have already started this order. Please ask the Xchange counter to cancel it.");
      setStatus(s,x.id,a.to,a.actor,a.to==="Cancelled"?(a.role==="student"?"Cancelled by student.":"Cancelled by staff."):undefined);
      if(a.to==="Cancelled")closeQueue(s,x.id,"Left");
      const t=notice[a.to];if(t)notify(s,x.studentId,t[0],t[1].replace("{ref}",x.reference),x.id);
      log(s,"reservation",a.actor,`${x.reference} marked ${a.to}`,x.id);
      return{state:s,ok:true,message:`${x.reference} is now ${a.to}.`};
    }
    case "joinQueue":{
      const x=reservationOf(s,a.reservationId);if(!x)return fail(prev,"Reservation not found.");
      if(x.status!=="Ready for Pickup")return fail(prev,"Only reservations that are Ready for Pickup can join the queue.");
      if(queueEntryFor(s,x.id))return fail(prev,"This reservation is already in the pickup queue.");
      const q:QueueEntry={id:`q-${s.counters.queue}`,number:`Q-${pad(s.counters.queue,3)}`,reservationId:x.id,studentId:x.studentId,type:"Regular",status:"Waiting",joinedAt:s.now};s.counters.queue++;
      s.queue=[...s.queue,q];log(s,"queue",a.actor,`${q.number} joined the pickup queue for ${x.reference}`,x.id);
      return{state:s,ok:true,message:`Queue number ${q.number} issued for ${x.reference}.`,created:q.id};
    }
    case "leaveQueue":{
      const q=s.queue.find(e=>e.id===a.queueId);if(!q)return fail(prev,"Queue entry not found.");
      if(q.status!=="Waiting")return fail(prev,q.status==="Serving"?"This student is being served. Skip or complete the pickup instead.":"This queue entry is already closed.");
      s.queue=s.queue.map(e=>e.id===q.id?{...e,status:"Left",doneAt:s.now}:e);log(s,"queue",a.actor,`${q.number} left the pickup queue`,q.reservationId);
      return{state:s,ok:true,message:`${q.number} left the queue.`};
    }
    case "callNext":{
      if(s.queue.some(q=>q.status==="Serving"))return fail(prev,"Finish or skip the current pickup before calling the next student.");
      const next=[...s.queue].filter(q=>q.status==="Waiting").sort((p,q)=>(p.type===q.type?0:p.type==="Express"?-1:1)||Date.parse(p.joinedAt)-Date.parse(q.joinedAt))[0];
      if(!next)return fail(prev,"No one is waiting in the queue.");
      s.queue=s.queue.map(q=>q.id===next.id?{...q,status:"Serving",calledAt:s.now}:q);
      const st=studentOf(s,next.studentId)!;log(s,"queue",a.actor,`Called ${next.number} (${st.name})`,next.reservationId);
      notify(s,next.studentId,"Your number was called",`${next.number} is now being served at the Xchange counter.`,next.reservationId);
      return{state:s,ok:true,message:`Now serving ${next.number} (${st.name}).`};
    }
    case "skip":{
      const q=s.queue.find(e=>e.id===a.queueId);if(!q)return fail(prev,"Queue entry not found.");
      if(q.status!=="Serving")return fail(prev,"Only the student currently being served can be skipped.");
      s.queue=s.queue.map(e=>e.id===q.id?{...e,status:"Skipped",doneAt:s.now}:e);log(s,"queue",a.actor,`Skipped ${q.number}`,q.reservationId);
      return{state:s,ok:true,message:`${q.number} was skipped. The student can rejoin the queue.`};
    }
    case "release":{
      const x=reservationOf(s,a.reservationId);if(!x)return fail(prev,"Reservation not found.");
      if(x.status!=="Ready for Pickup")return fail(prev,"Only reservations that are Ready for Pickup can be released.");
      const q=queueEntryFor(s,x.id);
      if(q&&q.status==="Waiting")return fail(prev,"This student is still waiting in the queue. Call their number first.");
      for(const l of x.lines){
        const v=variantOf(s,l.variantId)!;if(v.physical<l.qty)return fail(prev,"Physical stock is lower than the reserved quantity. Adjust inventory first.");
        s.variants=s.variants.map(y=>y.id===v.id?{...y,physical:y.physical-l.qty}:y);
        s.movements=[...s.movements,{id:`mv-${s.counters.movement++}`,at:s.now,variantId:v.id,type:"Pickup release",change:-l.qty,resulting:v.physical-l.qty,actor:a.actor,note:x.reference}];
      }
      if(q)s.queue=s.queue.map(e=>e.id===q.id?{...e,status:"Completed",doneAt:s.now}:e);
      setStatus(s,x.id,"Completed",a.actor);
      const t=notice.Completed!;notify(s,x.studentId,t[0],t[1].replace("{ref}",x.reference),x.id);
      log(s,"reservation",a.actor,`${x.reference} released and completed`,x.id);
      return{state:s,ok:true,message:`${x.reference} released. Pickup completed.`};
    }
    case "decideStudent":{
      const st=studentOf(s,a.studentId);if(!st)return fail(prev,"Student not found.");
      const rules:Record<typeof a.decision,[string,"approved"|"rejected"|"suspended",string]>={approve:["pending","approved","Approved"],reject:["pending","rejected","Rejected"],suspend:["approved","suspended","Suspended"],restore:["suspended","approved","Restored"]};
      const[from,to,verb]=rules[a.decision];
      if(st.status!==from)return fail(prev,`${verb==="Restored"?"Only suspended":from==="pending"?"Only pending":"Only approved"} accounts can be ${verb.toLowerCase()}.`);
      const reason=a.reason?.trim();
      if((a.decision==="reject"||a.decision==="suspend")&&!reason)return fail(prev,`A reason is required to ${a.decision} an account.`);
      s.students=s.students.map(x=>x.id===st.id?{...x,status:to,decidedAt:s.now,decidedBy:a.actor,reason:a.decision==="reject"||a.decision==="suspend"?reason:undefined}:x);
      log(s,"account",a.actor,`${verb} ${st.name} (${st.studentId})${reason?`: ${reason}`:""}`,st.id);
      return{state:s,ok:true,message:`${verb} ${st.name}.`};
    }
    case "adjustStock":{
      const v=variantOf(s,a.variantId);if(!v)return fail(prev,"Variant not found.");
      const{reserved}=stockOf(prev,v.id);
      if(!Number.isInteger(a.qty)||a.qty<0)return fail(prev,"Enter a whole number of units.");
      let next:number,type:"Receive stock"|"Correction"|"Write-off";
      if(a.mode==="receive"){if(a.qty<1)return fail(prev,"Enter at least 1 unit to receive.");next=v.physical+a.qty;type="Receive stock"}
      else if(a.mode==="writeoff"){if(a.qty<1)return fail(prev,"Enter at least 1 unit to write off.");next=v.physical-a.qty;type="Write-off"}
      else{next=a.qty;type="Correction"}
      if(next<reserved)return fail(prev,`Physical stock cannot go below the ${reserved} unit${reserved===1?"":"s"} already reserved.`);
      if(next===v.physical)return fail(prev,"That would not change the stock count.");
      const p=productOf(s,v.productId)!;
      s.variants=s.variants.map(y=>y.id===v.id?{...y,physical:next}:y);
      s.movements=[...s.movements,{id:`mv-${s.counters.movement++}`,at:s.now,variantId:v.id,type,change:next-v.physical,resulting:next,actor:a.actor,...(a.note?.trim()?{note:a.note.trim()}:{})}];
      log(s,"stock",a.actor,`${type}: ${p.title} (${v.name}) ${v.physical} to ${next}`,v.id);
      return{state:s,ok:true,message:`${p.title} (${v.name}) now has ${next} physical units.`};
    }
    case "acknowledgePayment":{
      const x=reservationOf(s,a.reservationId);if(!x)return fail(prev,"Reservation not found.");
      if(!isActive(x.status))return fail(prev,"This reservation is no longer active.");
      if(x.downPayment.status!=="Awaiting payment"&&x.downPayment.status!=="Not verified")return fail(prev,x.downPayment.status==="Verified"?"The down payment is already verified.":"The down payment is already awaiting verification.");
      s.reservations=s.reservations.map(y=>y.id===x.id?{...y,downPayment:{...y.downPayment,status:"Awaiting verification",updatedAt:s.now}}:y);
      log(s,"payment",a.actor,`${x.reference}: student reported a down payment (simulated, not verified)`,x.id);
      return{state:s,ok:true,message:`Down payment for ${x.reference} is now awaiting staff verification.`};
    }
    case "verifyPayment":{
      const x=reservationOf(s,a.reservationId);if(!x)return fail(prev,"Reservation not found.");
      if(!isActive(x.status))return fail(prev,"This reservation is no longer active.");
      const cur=x.downPayment.status;
      if(a.decision==="verify"){if(cur==="Verified")return fail(prev,"The down payment is already verified.");if(cur==="Not verified")return fail(prev,"The student must report the payment again before it can be verified.")}
      else if(cur!=="Awaiting verification")return fail(prev,"Only a payment awaiting verification can be marked not verified.");
      const to=a.decision==="verify"?"Verified" as const:"Not verified" as const;
      s.reservations=s.reservations.map(y=>y.id===x.id?{...y,downPayment:{...y.downPayment,status:to,updatedAt:s.now}}:y);
      log(s,"payment",a.actor,`${x.reference}: down payment ${to.toLowerCase()} (simulated)`,x.id);
      notify(s,x.studentId,to==="Verified"?"Down payment verified":"Down payment not verified",to==="Verified"?`Staff verified the down payment for ${x.reference}. This is a simulated demo record.`:`Staff could not verify the down payment for ${x.reference}. Please contact the Xchange counter.`,x.id);
      return{state:s,ok:true,message:`Down payment for ${x.reference} marked ${to.toLowerCase()}.`};
    }
    case "saveProduct":return saveProduct(prev,s,a.product,a.actor);
    case "archiveProduct":{
      const p=productOf(s,a.productId);if(!p)return fail(prev,"Product not found.");
      if(p.active===!a.archived)return fail(prev,a.archived?"This item is already archived.":"This item is already active.");
      s.products=s.products.map(y=>y.id===p.id?{...y,active:!a.archived}:y);
      log(s,"product",a.actor,`${a.archived?"Archived":"Restored"} ${p.title}`,p.id);
      return{state:s,ok:true,message:a.archived?`${p.title} archived. It is hidden from students; existing reservations are unaffected.`:`${p.title} restored to the catalog.`};
    }
    case "deleteProduct":{
      const p=productOf(s,a.productId);if(!p)return fail(prev,"Product not found.");
      const ids=new Set(s.variants.filter(v=>v.productId===p.id).map(v=>v.id));
      const refs=s.reservations.filter(x=>x.lines.some(l=>ids.has(l.variantId))).length;
      if(refs>0)return fail(prev,`${p.title} is referenced by ${refs} reservation${refs===1?"":"s"} and cannot be deleted. Archive it instead.`);
      s.products=s.products.filter(y=>y.id!==p.id);s.variants=s.variants.filter(v=>!ids.has(v.id));s.movements=s.movements.filter(m=>!ids.has(m.variantId));
      log(s,"product",a.actor,`Deleted ${p.title}`,p.id);
      return{state:s,ok:true,message:`${p.title} deleted.`};
    }
    case "updateSettings":{
      const r=sanitizePolicy(a.settings,s.settings);if(!r.ok)return fail(prev,r.message);
      s.settings=r.policy;log(s,"settings",a.actor,`Demo policy updated: ${Math.round(r.policy.downPaymentRate*100)}% down payment, ${r.policy.maxUnitsPerItem} units per item`);
      return{state:s,ok:true,message:"Demo policy updated. It applies to new reservations."};
    }
    case "markRead":{
      s.notifications=s.notifications.map(n=>n.studentId===a.studentId&&(!a.notificationId||n.id===a.notificationId)?{...n,read:true}:n);
      return{state:s,ok:true,message:"Notifications marked as read."};
    }
  }
}

const SKU_RE=/^[A-Z0-9][A-Z0-9-]{1,23}$/;
/** Validates and applies an add or edit of a product with its variants. Mock state only. */
function saveProduct(prev:DemoState,s:DemoState,input:ProductInput,actor:string):Result{
  const title=input.title.trim(),sku=input.sku.trim().toUpperCase(),description=input.description.trim();
  if(title.length<2||title.length>80)return fail(prev,"Enter a product name of 2 to 80 characters.");
  if(!CATEGORIES.includes(input.category))return fail(prev,"Choose a category.");
  if(!SKU_RE.test(sku))return fail(prev,"Enter a SKU of 2 to 24 letters, numbers, or hyphens.");
  if(s.products.some(p=>p.sku===sku&&p.id!==input.id))return fail(prev,`SKU ${sku} is already used by another product.`);
  if(!Number.isFinite(input.price)||input.price<=0||input.price>99999)return fail(prev,"Enter a price greater than 0.");
  if(description.length>300)return fail(prev,"Keep the description under 300 characters.");
  if(input.imageUrl&&!/^\/[\w./-]+$/.test(input.imageUrl))return fail(prev,"Image path must be a local path such as /images/tee.jpg. Leave it empty to use the placeholder.");
  if(input.variants.length<1)return fail(prev,"Add at least one variant or size.");
  const names=input.variants.map(v=>v.name.trim());
  if(names.some(n=>!n||n.length>20))return fail(prev,"Each variant needs a name of up to 20 characters.");
  if(new Set(names.map(n=>n.toLowerCase())).size!==names.length)return fail(prev,"Variant names must be unique.");
  for(const v of input.variants){
    if(!Number.isInteger(v.reorder)||v.reorder<0)return fail(prev,"Reorder levels must be whole numbers, 0 or more.");
    if(!v.id&&v.initialStock!==undefined&&(!Number.isInteger(v.initialStock)||v.initialStock<0))return fail(prev,"Initial stock must be a whole number, 0 or more.");
  }
  const price=Math.round(input.price*100)/100,img=input.imageUrl||undefined;
  if(!input.id){
    const id=`prd-${String(s.counters.product++).padStart(2,"0")}`;
    s.products=[...s.products,{id,title,category:input.category,sku,description,price,featured:input.featured,active:true,...(img?{imageUrl:img}:{})}];
    for(const v of input.variants){
      const name=v.name.trim(),vid=`${id}-${name.replace(/\s+/g,"")}`,stock=v.initialStock??0;
      s.variants=[...s.variants,{id:vid,productId:id,name,sku:(v.sku?.trim().toUpperCase())||`${sku}-${name.toUpperCase().replace(/\s+/g,"")}`,physical:stock,reorder:v.reorder}];
      if(stock>0)s.movements=[...s.movements,{id:`mv-${s.counters.movement++}`,at:s.now,variantId:vid,type:"Opening count",change:stock,resulting:stock,actor,note:"Initial stock for a new product."}];
    }
    log(s,"product",actor,`Added product ${title} (${sku})`,id);
    return{state:s,ok:true,message:`${title} added to the catalog.`,created:id};
  }
  const cur=productOf(s,input.id);if(!cur)return fail(prev,"Product not found.");
  const existing=s.variants.filter(v=>v.productId===cur.id),keep=new Set(input.variants.filter(v=>v.id).map(v=>v.id!));
  for(const v of input.variants)if(v.id&&!existing.some(e=>e.id===v.id))return fail(prev,"A variant no longer exists. Close the form and try again.");
  for(const e of existing)if(!keep.has(e.id)&&s.reservations.some(x=>x.lines.some(l=>l.variantId===e.id)))return fail(prev,`Size ${e.name} is used by reservations and cannot be removed. Archive the product instead.`);
  const removed=new Set(existing.filter(e=>!keep.has(e.id)).map(e=>e.id));
  s.products=s.products.map(p=>p.id===cur.id?{...p,title,category:input.category,sku,description,price,featured:input.featured,imageUrl:img}:p);
  s.variants=s.variants.filter(v=>!removed.has(v.id)).map(v=>{const i=input.variants.find(x=>x.id===v.id);return i?{...v,name:i.name.trim(),reorder:i.reorder,...(i.sku?.trim()?{sku:i.sku.trim().toUpperCase()}:{})}:v});
  s.movements=s.movements.filter(m=>!removed.has(m.variantId));
  for(const v of input.variants.filter(x=>!x.id)){
    const name=v.name.trim(),vid=`${cur.id}-${name.replace(/\s+/g,"")}`,stock=v.initialStock??0;
    if(s.variants.some(x=>x.id===vid))return fail(prev,`Variant ${name} already exists.`);
    s.variants=[...s.variants,{id:vid,productId:cur.id,name,sku:(v.sku?.trim().toUpperCase())||`${sku}-${name.toUpperCase().replace(/\s+/g,"")}`,physical:stock,reorder:v.reorder}];
    if(stock>0)s.movements=[...s.movements,{id:`mv-${s.counters.movement++}`,at:s.now,variantId:vid,type:"Opening count",change:stock,resulting:stock,actor,note:"Initial stock for a new variant."}];
  }
  log(s,"product",actor,`Edited product ${title}`,cur.id);
  return{state:s,ok:true,message:`${title} updated.`,created:cur.id};
}
