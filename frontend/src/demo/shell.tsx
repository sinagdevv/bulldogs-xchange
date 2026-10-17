import {useMemo,useState} from "react";
import {Link,NavLink,useLocation,useNavigate} from "react-router-dom";
import {AppLayout,PageHeader} from "../components";
import {Icon,type IconName} from "../icons";
import {SessionContext,type SessionState} from "../session-context";
import {useRun} from "./hooks";
import {useDemo} from "./store-context";
import {ConfirmDialog} from "./ui";
import {Brand} from "../brand";
import {demoNav,DEMO_ROLES,DEMO_ROOT,unreadBadge,type DemoRole} from "./roles";
import {isActive,unreadFor} from "./engine";
import type {Role} from "../types";
import "./demo.css";

const roleMap:Record<DemoRole,Role>={student:"Customer",staff:"Staff",admin:"Admin"};

/** Switch between Student, Staff, Admin, and Brand without leaving the preview. Labels collapse to a select on small screens. */
export function DemoSwitcher(){
  const{pathname}=useLocation(),navigate=useNavigate(),current=DEMO_ROLES.find(r=>pathname.startsWith(r.to))?.to??"";
  return <>
    <nav className="demo-switch" aria-label="Switch demo role">{DEMO_ROLES.map(r=><NavLink key={r.id} to={r.to}>{r.short}</NavLink>)}</nav>
    <select className="demo-switch-select" aria-label="Switch demo role" value={current} onChange={e=>navigate(e.target.value)}>{current===""&&<option value="" disabled>Switch role</option>}{DEMO_ROLES.map(r=><option key={r.id} value={r.to}>{r.label}</option>)}</select>
  </>;
}

export function ResetDemoButton({label=true}:{label?:boolean}){
  const[ask,setAsk]=useState(false),run=useRun(),navigate=useNavigate(),{pathname}=useLocation();
  const go=()=>{run({type:"reset"});setAsk(false);const role=DEMO_ROLES.find(r=>pathname.startsWith(r.to));navigate(role&&role.id!=="brand"?role.to:DEMO_ROOT)};
  return <><button type="button" className={label?"btn btn-secondary btn-sm":"icon-btn"} onClick={()=>setAsk(true)} aria-label="Reset demo data" title="Reset demo data"><Icon name="refresh"/>{label&&<span className="reset-label">Reset demo</span>}</button>
    {ask&&<ConfirmDialog title="Reset demo data?" description="This restores the original demo dataset. Reservations, approvals, queue entries, and stock changes you made will be lost." confirmLabel="Reset demo" onConfirm={go} onCancel={()=>setAsk(false)}/>}</>;
}

/** Workspace shell for each demo role. Uses a fake session purely so the real sidebar and topbar can render. */
export function DemoShell({role}:{role:DemoRole}){
  const{state}=useDemo(),navigate=useNavigate();
  const name=role==="student"?state.students.find(s=>s.id===state.personas.student)!.name:state.staff.find(s=>s.id===state.personas[role])!.name;
  const value=useMemo<SessionState>(()=>({session:{authenticated:true,user:{id:"demo",email:"demo@demo.invalid",displayName:name,role:roleMap[role]}},loading:false,error:null,authOpen:false,api:null as unknown as SessionState["api"],login:async()=>{},loginOtp:async()=>{},requestOtp:async()=>{},register:async()=>{},requestPasswordReset:async()=>{},openAuth:()=>{},closeAuth:()=>{},reload:async()=>{},logout:async()=>{navigate(DEMO_ROOT)}}),[name,role,navigate]);
  const unread=role==="student"?unreadFor(state,state.personas.student):0,badge=unreadBadge(unread,state.settings.notificationBadgeCap);
  const groups=useMemo(()=>demoNav(role,{unread,cap:state.settings.notificationBadgeCap}),[role,unread,state.settings.notificationBadgeCap]);
  return <SessionContext.Provider value={value}><AppLayout role={roleMap[role]} groups={groups} homeTo={DEMO_ROOT} badge="DEMO PREVIEW" notificationsTo={role==="student"?`${DEMO_ROOT}/student/notifications`:`${DEMO_ROOT}/${role}`} bell={badge} topbarExtra={<><DemoSwitcher/><ResetDemoButton label={false}/></>}/></SessionContext.Provider>;
}

/* ---------------- Role selector (entry point) ---------------- */
export function DemoHome(){
  const{state}=useDemo();
  const ready=state.reservations.filter(r=>r.status==="Ready for Pickup").length,pending=state.students.filter(s=>s.status==="pending").length,open=state.reservations.filter(r=>isActive(r.status)).length;
  const cards:{icon:IconName;title:string;to:string;blurb:string;points:string[];stat:string}[]=[
    {icon:"id",title:"Student Demo",to:`${DEMO_ROOT}/student`,blurb:"Browse merchandise, reserve an item, and follow it to pickup.",points:["Search, filter, and sort the catalog","Reserve with a limit check and see the down payment","Reservation History, cancel, and unread notifications"],stat:"Signed in as Ana Reyes (demo)"},
    {icon:"store",title:"Staff Demo",to:`${DEMO_ROOT}/staff`,blurb:"Run the counter: confirm, prepare, call numbers, and release items.",points:["Verify simulated down payments and move reservations","Filter the pickup queue by status and date","Call, skip, and release items at the counter"],stat:`${open} open reservations, ${ready} ready for pickup`},
    {icon:"shield",title:"Admin Demo",to:`${DEMO_ROOT}/admin`,blurb:"Manage products and students, then review analytics and reports.",points:["Add, edit, archive, or delete demo products","Approve students and review account history","Analytics, fast and slow movers, CSV and print reports"],stat:`${pending} student accounts awaiting approval`},
    {icon:"layers",title:"Brand Preview",to:`${DEMO_ROOT}/brand`,blurb:"Logo system, NU crest, colors, type, and components.",points:["NU crest and Bulldogs Xchange wordmark","Lockups for header, sidebar, auth, and footer","Buttons, status badges, and tokens"],stat:"Design reference"},
  ];
  return <div className="demo-home">
    <header className="demo-home-head"><div className="container inner"><NavLink to="/" className="dh-brand" aria-label="Live landing page"><Brand tone="dark" size={56}/></NavLink><span className="eyebrow on-dark">Design preview</span><h1>Bulldogs Xchange demo</h1><p>One shared, fictional campus. Whatever you change in one role shows up in the others. Nothing here touches the real backend, Supabase, or any account.</p><div className="row"><ResetDemoButton/><Link className="btn btn-secondary btn-sm" to="/">Live landing page</Link></div></div></header>
    <main className="container demo-home-body">
      <div className="demo-cards">{cards.map(c=><article className="demo-card" key={c.title}><span className="ic"><Icon name={c.icon}/></span><h2>{c.title}</h2><p className="muted">{c.blurb}</p><ul>{c.points.map(p=><li key={p}><Icon name="check"/>{p}</li>)}</ul><small>{c.stat}</small><Link className="btn" to={c.to}>Open {c.title.replace(" Demo","").replace(" Preview","")}<Icon name="arrow"/></Link></article>)}</div>
      <section className="panel"><PageHeader eyebrow="Suggested walkthrough" title="A two minute demo path"/><ol className="walk">
        <li><span className="n">1</span><div><strong>Student reserves</strong><p>Pick an item, try to exceed the limit, then reserve and review the down payment and balance.</p><Link className="text-link" to={`${DEMO_ROOT}/student/shop`}>Start in the shop<Icon name="arrow"/></Link></div></li>
        <li><span className="n">2</span><div><strong>Staff process it</strong><p>Verify the down payment, confirm, prepare, mark ready, then filter the queue and release the items.</p><Link className="text-link" to={`${DEMO_ROOT}/staff/reservations`}>Open staff reservations<Icon name="arrow"/></Link></div></li>
        <li><span className="n">3</span><div><strong>Admin oversees</strong><p>Check the Total Reservations and Unpicked Items KPIs, add a product, then open analytics and print a report.</p><Link className="text-link" to={`${DEMO_ROOT}/admin`}>Open admin overview<Icon name="arrow"/></Link></div></li></ol></section>
      <section className="panel"><div className="panel-head"><h2>Other previews</h2></div><div className="row"><Link className="btn btn-secondary btn-sm" to={`${DEMO_ROOT}/login`}>Login dialog</Link><Link className="btn btn-secondary btn-sm" to={`${DEMO_ROOT}/register`}>Registration dialog</Link><Link className="btn btn-secondary btn-sm" to={`${DEMO_ROOT}/status`}>Account status screens</Link></div></section>
    </main></div>;
}
