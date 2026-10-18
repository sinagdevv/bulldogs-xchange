import {DEFAULT_POLICY,downPaymentFor} from "./policy";
import {catalogImageForSku} from "../product-images";
import type {AuditEvent,DownPaymentStatus,DemoNotification,DemoProduct,DemoReservation,DemoState,DemoStaff,DemoStudent,DemoVariant,HistoryEntry,QueueEntry,ResStatus,StockMovement,Category} from "./types";

/** Fixed demo clock: Fri 9 Oct 2026, 10:00 Manila time. Nothing here reads the real clock or a random source. */
export const DEMO_NOW="2026-10-09T02:00:00.000Z";
const NOW=Date.parse(DEMO_NOW),MIN=60000,HOUR=60*MIN,DAY=24*HOUR;
const at=(msAgo:number)=>new Date(NOW-msAgo).toISOString();

/** mulberry32: small seeded PRNG so every Reset Demo produces the identical dataset. */
function rng(seed:number){return()=>{seed|=0;seed=(seed+0x6d2b79f5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
type R=()=>number;
const int=(r:R,a:number,b:number)=>a+Math.floor(r()*(b-a+1));
const pick=<T,>(r:R,list:readonly T[]):T=>list[Math.floor(r()*list.length)]!;

const FIRST=["Ana","Mateo","Bea","Rafael","Carmela","Joaquin","Isabel","Gabriel","Patricia","Luis","Andrea","Nico","Camille","Diego","Sofia","Paolo","Katrina","Miguel","Alyssa","Enzo","Bianca","Jericho","Margarita","Renzo"];
const LAST=["Reyes","Santos","Dizon","Navarro","Bautista","Valdez","Ocampo","Mendoza","Villanueva","Aquino","Castillo","Domingo","Ramos","Salazar","Pascual","Tolentino","Soriano","Lacson","Mercado","Alvarez","Dela Cruz","Fernandez","Magno","Abad"];
const PROGRAMS=["BS Information Technology","BS Computer Science","BS Accountancy","BS Business Administration","BS Psychology","BS Architecture"];

const STAFF:DemoStaff[]=[
  {id:"stf-001",name:"Marco Villanueva",email:"marco.v@demo.invalid",role:"Staff"},{id:"stf-002",name:"Joy Santiago",email:"joy.s@demo.invalid",role:"Staff"},
  {id:"stf-003",name:"Ramon Cruz",email:"ramon.c@demo.invalid",role:"Staff"},{id:"stf-004",name:"Tessa Bautista",email:"tessa.b@demo.invalid",role:"Staff"},
  {id:"stf-005",name:"Paolo Navarro",email:"paolo.n@demo.invalid",role:"Staff"},{id:"stf-006",name:"Mika Domingo",email:"mika.d@demo.invalid",role:"Staff"},
  {id:"adm-001",name:"Lina Aquino",email:"lina.a@demo.invalid",role:"Admin"},{id:"adm-002",name:"Carlo Mendoza",email:"carlo.m@demo.invalid",role:"Admin"},
];

const APPAREL=["S","M","L","XL"],ONE=["Standard"];
type PDef=[string,Category,number,readonly string[],boolean,string,string];
const PRODUCTS:PDef[]=[
  ["Bulldogs Merchandise Shirt","T-shirts",399,APPAREL,true,"SHIRT","Verified merchandise photo; demo price and stock."],
  ["Fairview Pride Tee","T-shirts",379,APPAREL,false,"PTEE","Everyday tee for campus days."],
  ["Bulldogs Established 1900 Tee","T-shirts",429,APPAREL,false,"E19T","Commemorative tee for the university founding year."],
  ["NU Fairview Classic Polo","Polo shirts",549,APPAREL,true,"CPOL","Piqué polo with embroidered crest area."],
  ["Bulldogs Performance Polo","Polo shirts",649,APPAREL,false,"PPOL","Breathable polo for events and org activities."],
  ["Bulldogs Pullover Hoodie","Hoodies",1099,APPAREL,true,"PHOD","Midweight pullover hoodie with kangaroo pocket."],
  ["Bulldogs Zip Hoodie","Hoodies",1249,APPAREL,false,"ZHOD","Full zip hoodie with ribbed cuffs."],
  ["Bulldogs Varsity Jacket","Jackets",1899,APPAREL,true,"VJKT","Varsity jacket with contrast sleeves."],
  ["Campus Windbreaker","Jackets",1349,APPAREL,false,"WBRK","Light water-resistant windbreaker."],
  ["PE Uniform Shirt","Uniforms",349,APPAREL,false,"PEUS","Official PE uniform shirt."],
  ["PE Jogger Pants","Uniforms",449,APPAREL,false,"PEJP","Official PE jogger pants."],
  ["Laboratory Gown","Uniforms",649,APPAREL,false,"LGWN","Standard laboratory gown."],
  ["Bulldogs Merchandise Cap","Caps",349,ONE,true,"CAP","Verified merchandise photo; demo price and stock."],
  ["Bulldogs Dad Cap","Caps",329,ONE,false,"DCAP","Relaxed unstructured cap."],
  ["Bulldogs Merchandise Tote","Tote bags",249,ONE,true,"TOTE","Verified merchandise photo; demo price and stock."],
  ["Fairview Everyday Tote","Tote bags",299,ONE,false,"ETOT","Lined everyday tote with inner pocket."],
  ["Bulldogs Lanyard","Accessories",129,ONE,false,"LNYD","ID lanyard in university colors."],
  ["Bulldogs Tumbler 500ml","Accessories",499,ONE,true,"TMBL","Insulated 500 ml tumbler."],
  ["Enamel Pin Set","Accessories",199,ONE,false,"EPIN","Set of three collectible enamel pins."],
  ["Bulldogs Sticker Pack","Accessories",99,ONE,false,"STKP","Weatherproof sticker pack."],
];

const ACTIVE:ResStatus[]=["Pending","Confirmed","Preparing","Ready for Pickup"];
const PATHS:Record<string,ResStatus[]>={
  Pending:["Pending"],Confirmed:["Pending","Confirmed"],Preparing:["Pending","Confirmed","Preparing"],"Ready for Pickup":["Pending","Confirmed","Preparing","Ready for Pickup"],
  Completed:["Pending","Confirmed","Preparing","Ready for Pickup","Completed"],Cancelled:["Pending","Confirmed","Cancelled"],
};

export function createSeedState():DemoState{
  const r=rng(20261009);

  /* ---- students ---- */
  const used=new Set<string>(),students:DemoStudent[]=[];
  const statusFor=(i:number):DemoStudent["status"]=>i<17?"approved":i<25?"pending":i<29?"rejected":"suspended";
  for(let i=0;i<32;i++){
    let name=i===0?"Ana Reyes":"";
    while(!name||used.has(name)){name=`${pick(r,FIRST)} ${pick(r,LAST)}`}
    used.add(name);
    const status=statusFor(i),regAgo=status==="pending"?int(r,3,70)*HOUR:status==="approved"?int(r,25,60)*DAY:status==="rejected"?int(r,5,20)*DAY:int(r,15,40)*DAY;
    const s:DemoStudent={id:`stu-${String(i+1).padStart(3,"0")}`,studentId:`DEMO-2026-${String(i+1).padStart(4,"0")}`,name,email:`${name.toLowerCase().replace(/[^a-z]+/g,".")}@demo.invalid`,program:pick(r,PROGRAMS),year:int(r,1,4),status,registeredAt:at(regAgo)};
    if(status!=="pending"){s.decidedAt=at(regAgo-int(r,2,30)*HOUR);s.decidedBy=pick(r,STAFF.filter(x=>x.role==="Admin")).name}
    if(status==="rejected")s.reason=pick(r,["Student ID does not match school records.","Name does not match the enrollment list.","Duplicate registration for the same Student ID."]);
    if(status==="suspended")s.reason="Repeated no-shows on reserved items (demo scenario).";
    students.push(s);
  }

  /* ---- products and variants (stock is filled in after reservations are known) ---- */
  const products:DemoProduct[]=[],variants:DemoVariant[]=[];
  PRODUCTS.forEach(([title,category,price,sizes,,code,description],i)=>{
    const id=`prd-${String(i+1).padStart(2,"0")}`;
    const sku=`BX-${code}`,officialSku=code==="SHIRT"?"MRC-SHIRT":code==="CAP"?"MRC-CAP":code==="TOTE"?"MRC-TOTE":undefined,imageUrl=officialSku?catalogImageForSku(officialSku):undefined;
    products.push({id,title,category,sku,description,price,featured:Boolean(imageUrl),active:true,...(imageUrl?{imageUrl}:{})});
    sizes.forEach(sz=>variants.push({id:`${id}-${sz}`,productId:id,name:sz,sku:`BX-${code}-${sz==="Standard"?"STD":sz}`,physical:0,reorder:sizes.length>1?4:3}));
  });
  const pOf=(variantId:string)=>products.find(p=>p.id===variants.find(v=>v.id===variantId)!.productId)!;
  const variantsOf=(p:DemoProduct)=>variants.filter(v=>v.productId===p.id);
  const byTitle=(t:string)=>products.find(p=>p.title===t)!;

  /* ---- reservations ---- */
  const approved=students.filter(s=>s.status==="approved"&&s.id!=="stu-001"),persona=students[0]!;
  const staffNames=STAFF.filter(s=>s.role==="Staff").map(s=>s.name);
  interface Spec{student:DemoStudent;lines:[string,number][];status:ResStatus;endAgo:number;pathKey?:string}
  const specs:Spec[]=[];
  const lineOf=(title:string,size:string,qty:number):[string,number]=>[variants.find(v=>v.productId===byTitle(title).id&&v.name===size)!.id,qty];
  specs.push({student:persona,status:"Ready for Pickup",endAgo:2*HOUR,lines:[lineOf("Bulldogs Merchandise Shirt","M",1),lineOf("Bulldogs Merchandise Tote","Standard",1)]});
  specs.push({student:persona,status:"Preparing",endAgo:50*MIN,lines:[lineOf("Bulldogs Pullover Hoodie","L",1)]});
  specs.push({student:persona,status:"Completed",endAgo:9*DAY,lines:[lineOf("NU Fairview Classic Polo","M",2)]});
  specs.push({student:persona,status:"Cancelled",endAgo:12*DAY,lines:[lineOf("Bulldogs Dad Cap","Standard",1)]});
  const plan:[ResStatus,number][]=[["Completed",16],["Cancelled",3],["Pending",6],["Confirmed",4],["Preparing",3],["Ready for Pickup",5],["Expired",3]];
  let completedToday=0;
  for(const [status,count] of plan)for(let k=0;k<count;k++){
    const student=pick(r,approved),n=r()<.35?2:1,lines:[string,number][]=[];
    for(let l=0;l<n;l++){
      const p=r()<.5?pick(r,products.filter(x=>x.featured)):pick(r,products),vs=variantsOf(p),v=vs.length>1?vs[Math.min(vs.length-1,int(r,0,3))]!:vs[0]!;
      if(!lines.some(x=>x[0]===v.id))lines.push([v.id,vs.length>1?1:int(r,1,2)]);
    }
    let endAgo:number;
    if(status==="Completed"){endAgo=completedToday<5?(15+completedToday*20)*MIN:int(r,1,13)*DAY+int(r,1,600)*MIN;if(completedToday<5)completedToday++}
    else if(status==="Expired")endAgo=int(r,1,6)*DAY;
    else if(status==="Cancelled")endAgo=int(r,2,12)*DAY;
    else endAgo=int(r,5,70)*MIN*(status==="Pending"?4:1);
    specs.push({student,lines,status,endAgo});
  }

  const reservations:DemoReservation[]=[];
  const personaNames=(s:DemoStudent)=>s.name;
  specs.forEach((sp,idx)=>{
    let history:HistoryEntry[];
    if(sp.status==="Expired"){const c=sp.endAgo+5*DAY;history=[{status:"Pending",at:at(c),by:personaNames(sp.student)},{status:"Expired",at:at(sp.endAgo),by:"System",note:"Not picked up within 5 days."}]}
    else{
      const path=PATHS[sp.status]!,times:number[]=[];let t=sp.endAgo;times[path.length-1]=t;
      for(let k=path.length-2;k>=0;k--){t+=int(r,25,200)*MIN;times[k]=t}
      history=path.map((s,k)=>({status:s,at:at(times[k]!),by:k===0?personaNames(sp.student):pick(r,staffNames),...(s==="Cancelled"?{note:k>0&&sp.student.id==="stu-001"?"Cancelled by student.":"Cancelled at student request."}:{})}));
    }
    if(sp.status!=="Expired"){const back=int(r,0,sp.status==="Pending"?2:9)*DAY+int(r,0,500)*MIN;history[0]={...history[0]!,at:at(NOW-Date.parse(history[0]!.at)+back)}}
    const createdAt=history[0]!.at;
    reservations.push({id:`res-${idx+1}`,reference:"",studentId:sp.student.id,lines:sp.lines.map(([variantId,qty])=>({variantId,qty,unitPrice:pOf(variantId).price})),status:sp.status,createdAt,updatedAt:history[history.length-1]!.at,expiresAt:new Date(Date.parse(createdAt)+5*DAY).toISOString(),history,downPayment:{amount:0,rate:DEFAULT_POLICY.downPaymentRate,status:"Awaiting payment",updatedAt:createdAt}});
  });
  reservations.sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  reservations.forEach((x,i)=>{
    x.id=`res-${i+1}`;x.reference=`BX-DEMO-${String(i+1).padStart(4,"0")}`;
    const total=x.lines.reduce((n,l)=>n+l.qty*l.unitPrice,0),amount=downPaymentFor(total,DEFAULT_POLICY.downPaymentRate);
    /* Payment status is derived from how far the reservation got, with a few deterministic exceptions so every state is visible. */
    let status:DownPaymentStatus;
    if(["Confirmed","Preparing","Ready for Pickup","Completed"].includes(x.status))status="Verified";
    else if(x.status==="Pending")status=i%3===0?"Awaiting verification":"Awaiting payment";
    else if(x.status==="Cancelled")status=i%2===0?"Verified":"Awaiting payment";
    else status="Awaiting payment";
    if(x.status==="Confirmed"&&i%5===0)status="Awaiting verification";
    x.downPayment={amount,rate:DEFAULT_POLICY.downPaymentRate,status,updatedAt:x.updatedAt};
  });

  /* ---- inventory: physical stock = units currently held by active reservations + shelf stock ---- */
  const held=new Map<string,number>();
  for(const x of reservations)if(ACTIVE.includes(x.status))for(const l of x.lines)held.set(l.variantId,(held.get(l.variantId)??0)+l.qty);
  for(const v of variants){
    const p=products.find(x=>x.id===v.productId)!,roll=r();
    const shelf=p.featured?int(r,6,18):roll<.15?0:roll<.4?int(r,1,3):int(r,5,22);
    v.physical=(held.get(v.id)??0)+shelf;
  }

  /* ---- queue (today only) ---- */
  const queue:QueueEntry[]=[];
  let qn=1;
  const nextNumber=()=>`Q-${String(qn++).padStart(3,"0")}`;
  const todays=reservations.filter(x=>x.status==="Completed"&&NOW-Date.parse(x.updatedAt)<3*HOUR).sort((a,b)=>Date.parse(a.updatedAt)-Date.parse(b.updatedAt));
  for(const x of todays){const done=Date.parse(x.updatedAt);queue.push({id:`q-${qn}`,number:nextNumber(),reservationId:x.id,studentId:x.studentId,type:"Regular",status:"Completed",joinedAt:new Date(done-18*MIN).toISOString(),calledAt:new Date(done-6*MIN).toISOString(),doneAt:x.updatedAt})}
  const ready=reservations.filter(x=>x.status==="Ready for Pickup"&&x.studentId!=="stu-001").sort((a,b)=>Date.parse(a.updatedAt)-Date.parse(b.updatedAt));
  ready.slice(0,3).forEach((x,i)=>{queue.push({id:`q-${qn}`,number:nextNumber(),reservationId:x.id,studentId:x.studentId,type:i===2?"Express":"Regular",status:i===0?"Serving":"Waiting",joinedAt:at((22-i*6)*MIN),...(i===0?{calledAt:at(2*MIN)}:{})})});

  /* ---- movements ---- */
  const movements:StockMovement[]=[];
  const raw:Omit<StockMovement,"id"|"resulting">[]=[];
  for(const x of reservations)if(x.status==="Completed")for(const l of x.lines)raw.push({at:x.updatedAt,variantId:l.variantId,type:"Pickup release",change:-l.qty,actor:x.history[x.history.length-1]!.by});
  for(let k=0;k<8;k++){const v=pick(r,variants);raw.push({at:at(int(r,1,14)*DAY),variantId:v.id,type:"Receive stock",change:int(r,5,12),actor:"Lina Aquino",note:"Delivery from supplier (demo)."})}
  const net=new Map<string,number>();for(const m of raw)net.set(m.variantId,(net.get(m.variantId)??0)+m.change);
  const kept=raw.filter(m=>{if(m.type!=="Receive stock")return true;const v=variants.find(x=>x.id===m.variantId)!;const open=v.physical-(net.get(m.variantId)??0);if(open<0){net.set(m.variantId,(net.get(m.variantId)??0)-m.change);return false}return true});
  const running=new Map<string,number>();
  const opening:typeof raw=variants.map(v=>({at:at(21*DAY),variantId:v.id,type:"Opening count" as const,change:v.physical-(kept.filter(m=>m.variantId===v.id).reduce((s,m)=>s+m.change,0)),actor:"Lina Aquino"})).filter(m=>m.change>0);
  [...opening,...kept].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).forEach((m,i)=>{const res=(running.get(m.variantId)??0)+m.change;running.set(m.variantId,res);movements.push({...m,id:`mv-${i+1}`,resulting:res})});

  /* ---- notifications for the student persona ---- */
  const notifications:DemoNotification[]=[];
  const noteText:Partial<Record<ResStatus,[string,string]>>={Confirmed:["Reservation confirmed","Staff confirmed {ref}. We will start preparing it soon."],Preparing:["Order being prepared","{ref} is being prepared at the Xchange counter."],"Ready for Pickup":["Ready for pickup","{ref} is ready. Bring your school ID and join the pickup queue."],Completed:["Pickup completed","{ref} was picked up. Thank you, Bulldog!"],Cancelled:["Reservation cancelled","{ref} was cancelled and its stock was released."]};
  for(const x of reservations.filter(y=>y.studentId==="stu-001"))for(const h of x.history.slice(1)){const t=noteText[h.status];if(t)notifications.push({id:`ntf-${notifications.length+1}`,studentId:"stu-001",title:t[0],message:t[1].replace("{ref}",x.reference),at:h.at,read:NOW-Date.parse(h.at)>20*HOUR,reservationId:x.id})}
  notifications.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));notifications.forEach((n,i)=>{n.id=`ntf-${i+1}`});

  /* ---- audit trail ---- */
  const rawAudit:Omit<AuditEvent,"id">[]=[];
  for(const s of students)if(s.decidedAt)rawAudit.push({at:s.decidedAt,kind:"account",actor:s.decidedBy!,message:`${s.status==="approved"?"Approved":s.status==="rejected"?"Rejected":"Suspended"} ${s.name} (${s.studentId})`,ref:s.id});
  for(const x of reservations){const st=students.find(s=>s.id===x.studentId)!;x.history.forEach((h,k)=>rawAudit.push({at:h.at,kind:"reservation",actor:h.by,message:k===0?`Reserved ${x.reference} for ${st.name}`:`${x.reference} marked ${h.status}`,ref:x.id}))}
  for(const m of movements)if(m.type==="Receive stock")rawAudit.push({at:m.at,kind:"stock",actor:m.actor,message:`Received ${m.change} units (${m.variantId})`,ref:m.variantId});
  rawAudit.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const audit=rawAudit.map((e,i)=>({...e,id:`aud-${i+1}`}));

  return{version:3,settings:{...DEFAULT_POLICY},now:DEMO_NOW,students,staff:STAFF,products,variants,reservations,queue,notifications,audit,movements,
    counters:{reservation:reservations.length+1,queue:qn,audit:audit.length+1,movement:movements.length+1,notification:notifications.length+1,product:products.length+1,variant:variants.length+1},
    personas:{student:"stu-001",staff:"stf-001",admin:"adm-001"}};
}
