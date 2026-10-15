import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it} from "vitest";
import {applyAction,productStock,reservationOf,stockOf,TRANSITIONS} from "./engine";
import {createSeedState} from "./seed";
import {DemoProvider} from "./store";
import {DemoHome,DemoSwitcher} from "./shell";
import {demoNav,DEMO_ROLES} from "./roles";
import {placeholderKind} from "../placeholder-data";
import type {Action,DemoState} from "./types";
import appSource from "../App.tsx?raw";

const sources=import.meta.glob<string>("./*.{ts,tsx}",{query:"?raw",import:"default",eager:true});
const demoFiles=Object.entries(sources).filter(([f])=>!f.includes(".test."));

const ok=(s:DemoState,a:Action)=>{const r=applyAction(s,a);expect(r.ok,r.message).toBe(true);return r};
const approvedStudent=(s:DemoState)=>s.students.find(x=>x.status==="approved"&&x.id!==s.personas.student)!;
const freshVariant=(s:DemoState)=>s.variants.find(v=>stockOf(s,v.id).available>=3)!;

describe("seed data",()=>{
  const s=createSeedState();
  it("meets the requested volumes and is deterministic",()=>{
    expect(s.students.length).toBeGreaterThanOrEqual(25);expect(s.students.length).toBeLessThanOrEqual(40);
    expect(s.staff.filter(x=>x.role==="Staff").length).toBeGreaterThanOrEqual(5);expect(s.staff.filter(x=>x.role==="Admin").length).toBeGreaterThanOrEqual(2);
    expect(s.products.length).toBeGreaterThanOrEqual(15);expect(s.reservations.length).toBeGreaterThanOrEqual(30);expect(s.reservations.length).toBeLessThanOrEqual(50);
    for(const st of ["pending","approved","rejected","suspended"] as const)expect(s.students.some(x=>x.status===st)).toBe(true);
    expect(JSON.stringify(createSeedState())).toBe(JSON.stringify(s));
  });
  it("uses clearly fictional identifiers",()=>{
    for(const x of s.students){expect(x.studentId).toMatch(/^DEMO-2026-\d{4}$/);expect(x.email.endsWith("@demo.invalid")).toBe(true)}
  });
  it("keeps relationships consistent",()=>{
    for(const r of s.reservations){expect(s.students.some(x=>x.id===r.studentId)).toBe(true);for(const l of r.lines)expect(s.variants.some(v=>v.id===l.variantId)).toBe(true);expect(r.history.length).toBeGreaterThan(0)}
    for(const v of s.variants){const st=stockOf(s,v.id);expect(st.available).toBe(st.physical-st.reserved);expect(st.available).toBeGreaterThanOrEqual(0)}
    for(const q of s.queue)expect(reservationOf(s,q.reservationId)).toBeDefined();
    expect(s.variants.some(v=>stockOf(s,v.id).status==="Low Stock")).toBe(true);
  });
  it("maps every category to a placeholder silhouette",()=>{
    for(const p of s.products)expect(["shirt","polo","hoodie","jacket","uniform","cap","tote","accessory"]).toContain(placeholderKind(p.title));
  });
});

describe("student reservation",()=>{
  it("creates a pending reservation and reduces availability without touching physical stock",()=>{
    const s=createSeedState(),v=freshVariant(s),me=s.personas.student,before=stockOf(s,v.id),n=s.reservations.length;
    const r=ok(s,{type:"reserve",studentId:me,variantId:v.id,qty:2});
    const created=reservationOf(r.state,r.created!)!;
    expect(created.status).toBe("Pending");expect(r.state.reservations.length).toBe(n+1);
    const after=stockOf(r.state,v.id);expect(after.available).toBe(before.available-2);expect(after.physical).toBe(before.physical);
    expect(s.reservations.length).toBe(n);
  });
  it("rejects invalid quantities, unapproved students, and over-reserving",()=>{
    const s=createSeedState(),v=freshVariant(s),pend=s.students.find(x=>x.status==="pending")!;
    expect(applyAction(s,{type:"reserve",studentId:s.personas.student,variantId:v.id,qty:0}).ok).toBe(false);
    expect(applyAction(s,{type:"reserve",studentId:pend.id,variantId:v.id,qty:1}).ok).toBe(false);
    expect(applyAction(s,{type:"reserve",studentId:s.personas.student,variantId:v.id,qty:stockOf(s,v.id).available+1}).ok).toBe(false);
  });
});

describe("staff status transitions",()=>{
  it("walks a reservation from Pending to Completed and deducts stock once",()=>{
    let s=createSeedState();const v=freshVariant(s),staff="Marco Villanueva";
    const r=ok(s,{type:"reserve",studentId:s.personas.student,variantId:v.id,qty:1});s=r.state;const id=r.created!;
    for(const to of ["Confirmed","Preparing","Ready for Pickup"] as const)s=ok(s,{type:"transition",reservationId:id,to,actor:staff,role:"staff"}).state;
    const j=ok(s,{type:"joinQueue",reservationId:id,actor:staff});s=j.state;
    for(let i=0;i<30&&s.queue.find(q=>q.id===j.created)?.status!=="Serving";i++){
      const cur=s.queue.find(q=>q.status==="Serving");
      if(cur)s=ok(s,{type:"release",reservationId:cur.reservationId,actor:staff}).state;
      s=ok(s,{type:"callNext",actor:staff}).state;
    }
    expect(s.queue.find(q=>q.id===j.created)!.status).toBe("Serving");
    const before=stockOf(s,v.id);
    s=ok(s,{type:"release",reservationId:id,actor:staff}).state;
    expect(reservationOf(s,id)!.status).toBe("Completed");
    const after=stockOf(s,v.id);expect(after.physical).toBe(before.physical-1);expect(after.available).toBe(before.available);
    expect(s.queue.find(q=>q.id===j.created)!.status).toBe("Completed");
    expect(applyAction(s,{type:"release",reservationId:id,actor:staff}).ok).toBe(false);
  });
  it("blocks impossible transitions",()=>{
    const s=createSeedState(),pending=s.reservations.find(r=>r.status==="Pending")!,done=s.reservations.find(r=>r.status==="Completed")!;
    expect(applyAction(s,{type:"transition",reservationId:pending.id,to:"Ready for Pickup",actor:"x",role:"staff"}).ok).toBe(false);
    expect(applyAction(s,{type:"transition",reservationId:pending.id,to:"Completed",actor:"x",role:"staff"}).ok).toBe(false);
    expect(applyAction(s,{type:"transition",reservationId:done.id,to:"Cancelled",actor:"x",role:"staff"}).ok).toBe(false);
    expect(TRANSITIONS.Completed).toEqual([]);
  });
  it("only lets students cancel before preparation, and cancelling frees stock",()=>{
    let s=createSeedState();const v=freshVariant(s),before=stockOf(s,v.id).available;
    const r=ok(s,{type:"reserve",studentId:s.personas.student,variantId:v.id,qty:1});s=r.state;
    s=ok(s,{type:"transition",reservationId:r.created!,to:"Cancelled",actor:"Ana",role:"student"}).state;
    expect(stockOf(s,v.id).available).toBe(before);
    const prep=s.reservations.find(x=>x.status==="Preparing")!;
    expect(applyAction(s,{type:"transition",reservationId:prep.id,to:"Cancelled",actor:"Ana",role:"student"}).ok).toBe(false);
  });
  it("only joins the queue when ready, and never twice",()=>{
    const s=createSeedState(),pending=s.reservations.find(r=>r.status==="Pending")!;
    expect(applyAction(s,{type:"joinQueue",reservationId:pending.id,actor:"x"}).ok).toBe(false);
    const queued=s.queue.find(q=>q.status==="Waiting")!;
    expect(applyAction(s,{type:"joinQueue",reservationId:queued.reservationId,actor:"x"}).ok).toBe(false);
  });
});

describe("admin approvals",()=>{
  it("approves, rejects with a reason, suspends, and restores, with audit history",()=>{
    let s=createSeedState();const [a,b]=s.students.filter(x=>x.status==="pending"),c=approvedStudent(s);
    s=ok(s,{type:"decideStudent",studentId:a!.id,decision:"approve",actor:"Lina Aquino"}).state;expect(s.students.find(x=>x.id===a!.id)!.status).toBe("approved");
    expect(applyAction(s,{type:"decideStudent",studentId:b!.id,decision:"reject",actor:"Lina Aquino"}).ok).toBe(false);
    s=ok(s,{type:"decideStudent",studentId:b!.id,decision:"reject",actor:"Lina Aquino",reason:"ID does not match records."}).state;
    expect(s.students.find(x=>x.id===b!.id)).toMatchObject({status:"rejected",reason:"ID does not match records."});
    s=ok(s,{type:"decideStudent",studentId:c.id,decision:"suspend",actor:"Lina Aquino",reason:"Unclaimed reservations."}).state;
    expect(applyAction(s,{type:"reserve",studentId:c.id,variantId:freshVariant(s).id,qty:1}).ok).toBe(false);
    s=ok(s,{type:"decideStudent",studentId:c.id,decision:"restore",actor:"Lina Aquino"}).state;expect(s.students.find(x=>x.id===c.id)!.status).toBe("approved");
    expect(s.audit.filter(e=>e.kind==="account"&&e.ref===c.id).length).toBeGreaterThanOrEqual(2);
  });
});

describe("inventory adjustments",()=>{
  it("receives, writes off, corrects, records movements, and never drops below reserved",()=>{
    let s=createSeedState();const v=s.variants.find(x=>stockOf(s,x.id).reserved>0&&stockOf(s,x.id).available>2)!,st0=stockOf(s,v.id),m=s.movements.length;
    s=ok(s,{type:"adjustStock",variantId:v.id,mode:"receive",qty:10,actor:"Lina Aquino",note:"Delivery"}).state;
    expect(stockOf(s,v.id).physical).toBe(st0.physical+10);expect(s.movements.length).toBe(m+1);
    s=ok(s,{type:"adjustStock",variantId:v.id,mode:"writeoff",qty:2,actor:"Lina Aquino"}).state;expect(stockOf(s,v.id).physical).toBe(st0.physical+8);
    s=ok(s,{type:"adjustStock",variantId:v.id,mode:"correct",qty:st0.reserved+1,actor:"Lina Aquino"}).state;expect(stockOf(s,v.id).available).toBe(1);
    expect(applyAction(s,{type:"adjustStock",variantId:v.id,mode:"correct",qty:st0.reserved-1,actor:"x"}).ok).toBe(false);
    expect(applyAction(s,{type:"adjustStock",variantId:v.id,mode:"writeoff",qty:50,actor:"x"}).ok).toBe(false);
    expect(productStock(s,v.productId).available).toBeGreaterThanOrEqual(0);
  });
});

describe("reset",()=>{
  it("restores the exact original dataset",()=>{
    let s=createSeedState();const v=freshVariant(s);
    s=ok(s,{type:"reserve",studentId:s.personas.student,variantId:v.id,qty:1}).state;
    s=ok(s,{type:"adjustStock",variantId:v.id,mode:"receive",qty:5,actor:"x"}).state;
    expect(JSON.stringify(s)).not.toBe(JSON.stringify(createSeedState()));
    expect(JSON.stringify(ok(s,{type:"reset"}).state)).toBe(JSON.stringify(createSeedState()));
  });
  it("does not mutate the previous state",()=>{
    const s=createSeedState(),snap=JSON.stringify(s);ok(s,{type:"reserve",studentId:s.personas.student,variantId:freshVariant(s).id,qty:1});expect(JSON.stringify(s)).toBe(snap);
  });
});

describe("navigation and role switching",()=>{
  const html=(node:React.ReactNode,at="/design-preview")=>renderToStaticMarkup(<MemoryRouter initialEntries={[at]}><DemoProvider>{node}</DemoProvider></MemoryRouter>);
  it("offers all four preview roles on the entry page and in the switcher",()=>{
    const home=html(<DemoHome/>);
    for(const t of ["Student Demo","Staff Demo","Admin Demo","Brand Preview"])expect(home).toContain(t);
    expect(home).toContain("Reset");
    const sw=html(<DemoSwitcher/>,"/design-preview/staff");
    for(const r of DEMO_ROLES)expect(sw).toContain(`href="${r.to}"`);
  });
  it("keeps every role route under /design-preview",()=>{
    for(const role of ["student","staff","admin"] as const)for(const g of demoNav(role))for(const i of g.items)expect(i.to.startsWith("/design-preview")).toBe(true);
    for(const r of DEMO_ROLES)expect(r.to.startsWith("/design-preview")).toBe(true);
  });
});

describe("mock data isolation",()=>{
  it("finds the demo modules to scan",()=>{expect(demoFiles.length).toBeGreaterThan(10)});
  it("never imports the API client, session provider, or Supabase, and never calls the network",()=>{
    for(const[f,src]of demoFiles){
      expect(src,f).not.toMatch(/from ["']\.\.\/api["']/);
      expect(src,f).not.toMatch(/(?:from|import)\s*\(?\s*["'][^"']*supabase[^"']*["']/i);
      expect(src,f).not.toMatch(/createClient\s*\(/);
      expect(src,f).not.toMatch(/\bfetch\s*\(/);
      expect(src,f).not.toMatch(/XMLHttpRequest|sendBeacon|WebSocket/);
      expect(src,f).not.toMatch(/Math\.random|Date\.now\(|new Date\(\)/);
    }
  });
  it("persists only to sessionStorage under a demo-specific key",()=>{
    const src=sources["./store.tsx"]!;
    expect(src).toContain("sessionStorage");expect(src).not.toContain("localStorage");expect(src).toContain("bx-demo-state-v3");
  });
  it("is only reachable through the development-only preview route",()=>{
    expect(appSource).toMatch(/import\.meta\.env\.DEV\?lazy/);
  });
});
