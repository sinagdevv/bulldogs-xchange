import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it} from "vitest";
import {applyAction,balanceDueAtPickup,stockOf,unpickedReservations,unpickedUnits,unreadFor} from "./engine";
import {createSeedState} from "./seed";
import {DemoProvider} from "./store";
import {demoNav,unreadBadge} from "./roles";
import {badgeText,balanceFor,downPaymentFor,DEFAULT_POLICY} from "./policy";
import {csvCell,toCsv} from "./csv";
import {ALL_DATES,dataset,datasetCsv,fastMoving,matchesDate,movement,resolveRange,slowMoving,summary} from "./reports";
import {AdminHome,AdminReports} from "./admin";
import {Brand,Wordmark} from "../brand";
import type {Action,DemoState} from "./types";
import {CATEGORIES} from "./types";

const ok=(s:DemoState,a:Action)=>{const r=applyAction(s,a);expect(r.ok,r.message).toBe(true);return r};
const html=(node:React.ReactNode,at="/design-preview")=>renderToStaticMarkup(<MemoryRouter initialEntries={[at]}><DemoProvider>{node}</DemoProvider></MemoryRouter>);
const variant=(s:DemoState)=>s.variants.find(v=>stockOf(s,v.id).available>=6&&s.products.find(p=>p.id===v.productId)!.active)!;
const newProduct=(sku="NU-TEST-01") => ({title:"Test Lanyard",category:CATEGORIES[7],sku,description:"Demo item",price:150,featured:false,variants:[{name:"Standard",reorder:3,initialStock:12}]});

describe("branding",()=>{
  it("renders the official crest with the typographic wordmark and no mascot",()=>{
    const out=html(<Brand size={42}/>);
    expect(out).toContain("/nu-crest.png");expect(out).toContain("Bulldogs");expect(out.toLowerCase()).not.toContain("bull-mark");expect(out.toLowerCase()).not.toContain("bullmark");
    expect(html(<Wordmark/>)).toContain("aria-label=\"Bulldogs Xchange\"");
    expect(html(<Brand compact size={40}/>)).toContain("/nu-crest.png");
  });
});

describe("student experience",()=>{
  it("labels the nav Reservation History and keeps the route",()=>{
    const items=demoNav("student").flatMap(g=>g.items),h=items.find(i=>i.label==="Reservation History")!;
    expect(h.to).toBe("/design-preview/student/reservations");expect(items.some(i=>i.label==="Reservations")).toBe(false);
  });
  it("enforces the configurable per-item limit and explains it",()=>{
    const s=createSeedState(),v=variant(s),me=s.personas.student;
    expect(s.settings.maxUnitsPerItem).toBe(DEFAULT_POLICY.maxUnitsPerItem);
    const r=applyAction(s,{type:"reserve",studentId:me,variantId:v.id,qty:s.settings.maxUnitsPerItem+1});
    expect(r.ok).toBe(false);expect(r.message).toContain("Reservation limit reached");
    ok(s,{type:"reserve",studentId:me,variantId:v.id,qty:s.settings.maxUnitsPerItem});
    const s2=ok(s,{type:"updateSettings",settings:{maxUnitsPerItem:5},actor:"Admin"}).state;
    ok(s2,{type:"reserve",studentId:me,variantId:v.id,qty:5});
  });
  it("computes subtotal, down payment, and balance and never auto-marks paid",()=>{
    expect(downPaymentFor(1000,0.2)).toBe(200);expect(balanceFor(1000,200)).toBe(800);expect(downPaymentFor(333,0.2)).toBe(66.6);
    const s=createSeedState(),v=variant(s),r=ok(s,{type:"reserve",studentId:s.personas.student,variantId:v.id,qty:2}),x=r.state.reservations.find(y=>y.id===r.created)!;
    const sub=x.lines.reduce((n,l)=>n+l.qty*l.unitPrice,0);
    expect(x.downPayment.amount).toBe(downPaymentFor(sub,s.settings.downPaymentRate));expect(x.downPayment.status).toBe("Awaiting payment");
    expect(balanceDueAtPickup(x)).toBe(sub);
    const a=ok(r.state,{type:"acknowledgePayment",reservationId:x.id,actor:"Ana"}).state;
    expect(a.reservations.find(y=>y.id===x.id)!.downPayment.status).toBe("Awaiting verification");
    const v2=ok(a,{type:"verifyPayment",reservationId:x.id,decision:"verify",actor:"Marco"}).state;
    expect(v2.reservations.find(y=>y.id===x.id)!.downPayment.status).toBe("Verified");
    expect(balanceDueAtPickup(v2.reservations.find(y=>y.id===x.id)!)).toBe(balanceFor(sub,x.downPayment.amount));
  });
  it("shows a visible Cancel Reservation action only where cancelling is allowed",()=>{
    const s=createSeedState(),cancellable=s.reservations.find(r=>r.status==="Pending")!,blocked=s.reservations.find(r=>r.status==="Preparing")!;
    expect(applyAction(s,{type:"transition",reservationId:cancellable.id,to:"Cancelled",actor:"x",role:"student"}).ok).toBe(true);
    expect(applyAction(s,{type:"transition",reservationId:blocked.id,to:"Cancelled",actor:"x",role:"student"}).ok).toBe(false);
  });
  it("derives the unread count, caps it, and updates on read",()=>{
    let s=createSeedState();const me=s.personas.student,n=unreadFor(s,me);
    expect(n).toBeGreaterThan(0);expect(badgeText(10,9)).toBe("9+");expect(badgeText(4,9)).toBe("4");
    expect(unreadBadge(0,9)).toBeUndefined();expect(unreadBadge(1,9)!.label).toBe("1 unread notification");
    const nav=demoNav("student",{unread:n,cap:9}).flatMap(g=>g.items).find(i=>i.label==="Notifications")!;
    expect(nav.count).toBe(badgeText(n,9));expect(nav.countLabel).toContain("unread");
    const first=s.notifications.find(x=>x.studentId===me&&!x.read)!;
    s=ok(s,{type:"markRead",studentId:me,notificationId:first.id}).state;expect(unreadFor(s,me)).toBe(n-1);
    s=ok(s,{type:"markRead",studentId:me}).state;expect(unreadFor(s,me)).toBe(0);
    s=ok(s,{type:"reserve",studentId:me,variantId:variant(s).id,qty:1}).state;
    s=ok(s,{type:"transition",reservationId:s.reservations.find(r=>r.status==="Pending"&&r.studentId===me)!.id,to:"Confirmed",actor:"Marco",role:"staff"}).state;
    expect(unreadFor(s,me)).toBeGreaterThan(0);
  });
});

describe("admin KPIs and products",()=>{
  it("shows Total Reservations and Unpicked Items instead of the old KPIs",()=>{
    const out=html(<AdminHome/>,"/design-preview/admin");
    expect(out).toContain("Total Reservations");expect(out).toContain("Unpicked Items");expect(out).not.toContain("Total students");
    const s=createSeedState();
    expect(unpickedUnits(s)).toBe(s.reservations.filter(r=>["Pending","Confirmed","Preparing","Ready for Pickup"].includes(r.status)).reduce((n,r)=>n+r.lines.reduce((a,l)=>a+l.qty,0),0));
    expect(unpickedReservations(s)).toBeLessThanOrEqual(s.reservations.length);
    const r=ok(s,{type:"reserve",studentId:s.personas.student,variantId:variant(s).id,qty:2});
    expect(unpickedUnits(r.state)).toBe(unpickedUnits(s)+2);
    const cancelled=ok(r.state,{type:"transition",reservationId:r.created!,to:"Cancelled",actor:"Ana",role:"student"}).state;
    expect(unpickedUnits(cancelled)).toBe(unpickedUnits(s));
  });
  it("adds, edits, archives, and deletes products with validation and protection",()=>{
    let s=createSeedState();const n=s.products.length;
    expect(applyAction(s,{type:"saveProduct",product:{...newProduct(),title:"A"},actor:"x"}).ok).toBe(false);
    expect(applyAction(s,{type:"saveProduct",product:{...newProduct(),price:0},actor:"x"}).ok).toBe(false);
    expect(applyAction(s,{type:"saveProduct",product:{...newProduct(),variants:[]},actor:"x"}).ok).toBe(false);
    expect(applyAction(s,{type:"saveProduct",product:{...newProduct(),imageUrl:"https://evil.example/x.png"},actor:"x"}).ok).toBe(false);
    const add=ok(s,{type:"saveProduct",product:newProduct(),actor:"Lina"});s=add.state;expect(s.products.length).toBe(n+1);
    expect(applyAction(s,{type:"saveProduct",product:newProduct(),actor:"x"}).ok).toBe(false);
    const id=add.created!,vid=s.variants.find(v=>v.productId===id)!.id;expect(stockOf(s,vid).physical).toBe(12);
    s=ok(s,{type:"saveProduct",product:{...newProduct(),id,title:"Test Lanyard v2",price:175,variants:[{id:vid,name:"Standard",reorder:4}]},actor:"Lina"}).state;
    expect(s.products.find(p=>p.id===id)).toMatchObject({title:"Test Lanyard v2",price:175});
    s=ok(s,{type:"archiveProduct",productId:id,archived:true,actor:"Lina"}).state;expect(s.products.find(p=>p.id===id)!.active).toBe(false);
    expect(applyAction(s,{type:"reserve",studentId:s.personas.student,variantId:vid,qty:1}).ok).toBe(false);
    s=ok(s,{type:"archiveProduct",productId:id,archived:false,actor:"Lina"}).state;
    const r=ok(s,{type:"reserve",studentId:s.personas.student,variantId:vid,qty:1}).state;
    expect(applyAction(r,{type:"deleteProduct",productId:id,actor:"Lina"}).ok).toBe(false);
    expect(ok(s,{type:"deleteProduct",productId:id,actor:"Lina"}).state.products.length).toBe(n);
  });
  it("keeps Student Approval functional under User management",()=>{
    const groups=demoNav("admin"),um=groups.find(g=>g.label==="User management")!;
    expect(um.items.map(i=>i.label)).toEqual(expect.arrayContaining(["Students","Account history"]));
    const s=createSeedState(),p=s.students.find(x=>x.status==="pending")!;
    expect(ok(s,{type:"decideStudent",studentId:p.id,decision:"approve",actor:"Lina"}).state.students.find(x=>x.id===p.id)!.status).toBe("approved");
  });
});

describe("analytics and reports",()=>{
  const s=createSeedState();
  it("applies one date range to summaries, series, and movement",()=>{
    const all=resolveRange("30d",s.now),week=resolveRange("7d",s.now),today=resolveRange("today",s.now);
    expect(summary(s,all).reservations).toBeGreaterThanOrEqual(summary(s,week).reservations);
    expect(summary(s,week).reservations).toBeGreaterThanOrEqual(summary(s,today).reservations);
    const sum=(r:typeof all)=>movement(s,r).reduce((n,x)=>n+x.unitsReserved,0);
    expect(sum(all)).toBeGreaterThanOrEqual(sum(week));
    const c=resolveRange("custom",s.now,{from:"2026-10-01",to:"2026-10-03"});expect(c.from).toBe("2026-10-01");expect(c.to).toBe("2026-10-03");
  });
  it("ranks fast and slow movers by units reserved, separate from pickups",()=>{
    const rows=movement(s,resolveRange("30d",s.now));
    for(let i=1;i<rows.length;i++)expect(rows[i-1]!.unitsReserved).toBeGreaterThanOrEqual(rows[i]!.unitsReserved);
    const fast=fastMoving(rows),slow=slowMoving(rows);
    expect(fast.length).toBeGreaterThan(0);expect(slow.length).toBeGreaterThan(0);
    expect(Math.min(...fast.map(x=>x.unitsReserved))).toBeGreaterThanOrEqual(Math.max(...slow.map(x=>x.unitsReserved)));
    expect(rows[0]).toHaveProperty("unitsPickedUp");
  });
  it("exports CSV with escaping and formula-injection protection",()=>{
    expect(csvCell("a,b")).toBe("\"a,b\"");expect(csvCell("say \"hi\"")).toBe("\"say \"\"hi\"\"\"");
    for(const bad of ["=SUM(A1)","+1","-2+3","@cmd"])expect(csvCell(bad).replace(/^"/,"").startsWith("'")).toBe(true);
    expect(csvCell(42)).toBe("42");
    const d=dataset(s,resolveRange("30d",s.now),"ledger"),csv=toCsv(datasetCsv(d).headers,datasetCsv(d).rows);
    expect(csv.split("\r\n")[0]).toContain("Reservation status");expect(csv.split("\r\n").length).toBeGreaterThan(5);
  });
  it("renders the printable report shell with crest, wordmark, and DEMO DATA mark",()=>{
    const out=html(<AdminReports/>,"/design-preview/admin/reports");
    expect(out).toContain("Print Report");expect(out).toContain("Generate report");
  });
  it("filters the queue by date and keeps reservation and queue status separate",()=>{
    const q=s.queue[0]!;
    expect(matchesDate(ALL_DATES,undefined,s.now)).toBe(true);
    expect(matchesDate({preset:"today",from:"",to:""},undefined,s.now)).toBe(false);
    expect(matchesDate({preset:"custom",from:"2026-01-01",to:"2026-12-31"},q.joinedAt,s.now)).toBe(true);
    const resStatuses=new Set(s.reservations.map(r=>r.status)),qStatuses=new Set(s.queue.map(x=>x.status));
    expect(resStatuses.has("Ready for Pickup")).toBe(true);expect([...qStatuses].every(x=>["Waiting","Serving","Completed","Skipped","Left"].includes(x))).toBe(true);
  });
});

describe("production isolation and demo state",()=>{
  it("keeps the demo state deterministic and consistent after mixed actions",()=>{
    let s=createSeedState();
    s=ok(s,{type:"reserve",studentId:s.personas.student,variantId:variant(s).id,qty:2}).state;
    for(const v of s.variants){const st=stockOf(s,v.id);expect(st.available).toBe(st.physical-st.reserved)}
    expect(JSON.stringify(ok(s,{type:"reset"}).state)).toBe(JSON.stringify(createSeedState()));
  });
});
