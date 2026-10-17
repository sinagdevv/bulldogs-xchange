/* Development-only design preview. Mounted only when import.meta.env.DEV is true (see App.tsx).
   Uses presentation fixtures and a fake session context. It never calls the API, never touches Supabase,
   and cannot reach protected production routes. */
import {useState,type ReactNode} from "react";
import {Navigate,NavLink,Route,Routes,useNavigate} from "react-router-dom";
import {ApprovalView,PageHeader,StatusBadge} from "./components";
import {AuthPanel} from "./account";
import {Brand,Crest,Wordmark} from "./brand";
import {ProductImagePlaceholder} from "./placeholder";
import type {PlaceholderKind} from "./placeholder-data";
import {Icon} from "./icons";
import {SessionContext,type SessionState} from "./session-context";
import {DemoProvider} from "./demo/store";
import {DemoHome,DemoShell} from "./demo/shell";
import {DEMO_ROOT} from "./demo/roles";
import {StudentHome,StudentShop,StudentProduct,StudentReservations,StudentReservationDetail,StudentNotifications} from "./demo/student";
import {StaffHome,StaffReservations,StaffQueue} from "./demo/staff";
import {AdminHome,AdminAnalytics,AdminApprovals,AdminInventory,AdminProducts,AdminReports,AdminSettings,AdminAccountHistory,AdminQueue} from "./demo/admin";

const ROOT=DEMO_ROOT;
const noopApi=null as unknown as SessionState["api"];
const base:Omit<SessionState,"session"|"authOpen"|"authMode"|"closeAuth"|"login"|"loginOtp"|"requestOtp"|"register"|"logout">={loading:false,error:null,api:noopApi,openAuth:()=>{},requestPasswordReset:async()=>{},reload:async()=>{}};

/* ---------- Scaffolding ---------- */
function PvBar(){return <header className="pv-bar"><NavLink to={ROOT} aria-label="Design preview index"><Brand size={34}/></NavLink><strong className="dev-badge">Design preview</strong><span className="spacer"/><NavLink className="text-link" to={ROOT}><Icon name="back"/>All previews</NavLink><NavLink className="btn btn-sm" to="/">Live landing page</NavLink></header>}
function PvPage({title,description,children}:{title:string;description?:string;children:ReactNode}){return <><PvBar/><main className="container page"><PageHeader eyebrow="Design preview" title={title} description={description}/>{children}</main></>}

/* ---------- Brand sheet ---------- */
const swatches:[string,string][]=[["Navy 950","#071b44"],["Navy 900","#0a2760"],["University blue","#123b8a"],["Strong blue","#1741a8"],["Gold","#d6a437"],["Light gold","#f1d58a"],["White","#ffffff"],["Off-white","#f6f8fc"],["Ink","#101a33"],["Muted","#5b6786"]];
const kinds:PlaceholderKind[]=["shirt","polo","hoodie","jacket","uniform","cap","tote","accessory"];
function BrandSheet(){return <PvPage title="Brand sheet" description="Official NU crest paired with a typographic Bulldogs Xchange wordmark. The crest is used as supplied and is never redrawn, recolored, or distorted.">
  <div className="pv-sheet">
    <section className="panel"><div className="panel-head"><h2>Lockups by placement</h2><p>The crest appears once per lockup. BULLDOGS is dominant and XCHANGE carries the gold accent.</p></div><div className="stack">
      <div className="pv-bg light"><Brand size={42}/><span className="muted">Desktop header</span></div>
      <div className="pv-bg light"><Brand size={34}/><span className="muted">Mobile header</span></div>
      <div className="pv-bg dark"><Brand tone="dark" size={40}/><span>Sidebar</span></div>
      <div className="pv-bg navy"><Brand tone="dark" size={84}/><span>Auth panel</span></div>
      <div className="pv-bg dark"><Brand tone="dark" size={52}/><span>Footer</span></div>
      <div className="pv-bg light"><Brand size={40}/><span className="muted">Dashboard and reports</span></div>
      <div className="pv-bg light"><Brand size={64}/><span className="muted">Light background</span></div>
      <div className="pv-bg dark"><Brand tone="dark" size={64}/><span>Dark background</span></div>
      <div className="pv-bg dark"><Brand light compact size={40}/><span>Compact (crest only, collapsed sidebar)</span></div>
    </div></section>
    <section className="panel"><div className="panel-head"><h2>Wordmark and NU crest</h2></div><div className="pv-row"><div className="pv-bg light"><Wordmark/></div><div className="pv-bg dark"><Wordmark tone="dark"/></div><div className="pv-bg light"><Crest size="lg"/><span className="muted">Official NU crest, supplied PNG (287 x 348, transparent background). Never recolored.</span></div></div></section>
    <section className="panel"><div className="panel-head"><h2>Color tokens</h2></div><div className="pv-row">{swatches.map(([n,c])=><div className="pv-swatch" key={c}><i style={{background:c}}/><strong>{n}</strong><code>{c}</code></div>)}</div></section>
    <section className="panel"><div className="panel-head"><h2>Typography</h2></div><div className="pv-type"><div style={{font:"800 3rem/1 var(--font-display)",letterSpacing:"-.03em"}}>Wear the Pride.</div><div style={{font:"800 1.8rem/1.1 var(--font-display)",letterSpacing:"-.02em"}}>Display: Bricolage Grotesque 800</div><p className="lead">Body: Public Sans 400 to 700. Clear, compact, and readable in dashboards and on phones.</p></div></section>
    <section className="panel"><div className="panel-head"><h2>Buttons and status</h2></div><div className="pv-row"><button className="btn" type="button">Primary</button><button className="btn btn-gold" type="button">Gold call to action</button><button className="btn btn-secondary" type="button">Secondary</button><button className="btn btn-ghost" type="button">Ghost</button><button className="btn btn-danger" type="button">Danger</button><StatusBadge value="Pending"/><StatusBadge value="Confirmed"/><StatusBadge value="Ready for Pickup"/><StatusBadge value="Cancelled"/></div></section>
    <section className="panel"><div className="panel-head"><h2>Product image placeholders</h2><p>Replaced by real photos later through the product image field.</p></div><div className="pv-grid compactgrid">{kinds.map((k,i)=><ProductImagePlaceholder key={k} kind={k} tone={(["blue","deep","light"] as const)[i%3]} size="sm"/>)}</div></section>
  </div></PvPage>}

/* ---------- Auth and status ---------- */
function AuthPreview({mode}:{mode:"login"|"register"}){
  const navigate=useNavigate();
  const value:SessionState={...base,session:{authenticated:false,user:null},authOpen:true,authMode:mode,closeAuth:()=>navigate(ROOT),login:async()=>{navigate(`${ROOT}/student`)},loginOtp:async()=>{navigate(`${ROOT}/student`)},requestOtp:async()=>{},register:async()=>{navigate(`${ROOT}/status`)},logout:async()=>{}};
  return <SessionContext.Provider value={value}><div className="pv-stage"><PvBar/><div className="container pv-stage-copy"><span className="eyebrow on-dark">Design preview</span><h1>{mode==="login"?"Student portal":"Create your account"}</h1><p>Preview only: credentials are not checked or sent anywhere. Logging in opens the student demo, and registering shows the Pending Approval screen.</p></div><AuthPanel/></div></SessionContext.Provider>;
}
function StatusPreview(){const[s,setS]=useState<"pending"|"rejected"|"suspended">("pending");return <PvPage title="Account status states"><div className="tabs" role="tablist">{(["pending","rejected","suspended"] as const).map(x=><button key={x} type="button" role="tab" aria-selected={s===x} className="tab" onClick={()=>setS(x)}>{x[0]!.toUpperCase()+x.slice(1)}</button>)}</div><ApprovalView status={s} reason={s==="rejected"?"Student ID does not match school records.":undefined} justRegistered={s==="pending"}/></PvPage>}

export default function PreviewRoutes(){return <DemoProvider><Routes>
  <Route index element={<DemoHome/>}/>
  <Route path="brand" element={<BrandSheet/>}/>
  <Route path="login" element={<AuthPreview mode="login"/>}/>
  <Route path="register" element={<AuthPreview mode="register"/>}/>
  <Route path="status" element={<StatusPreview/>}/>
  <Route element={<DemoShell role="student"/>}><Route path="student" element={<StudentHome/>}/><Route path="student/shop" element={<StudentShop/>}/><Route path="student/shop/:productId" element={<StudentProduct/>}/><Route path="student/reservations" element={<StudentReservations/>}/><Route path="student/reservations/:id" element={<StudentReservationDetail/>}/><Route path="student/notifications" element={<StudentNotifications/>}/></Route>
  <Route element={<DemoShell role="staff"/>}><Route path="staff" element={<StaffHome/>}/><Route path="staff/reservations" element={<StaffReservations/>}/><Route path="staff/queue" element={<StaffQueue/>}/></Route>
  <Route element={<DemoShell role="admin"/>}><Route path="admin" element={<AdminHome/>}/><Route path="admin/analytics" element={<AdminAnalytics/>}/><Route path="admin/approvals" element={<AdminApprovals/>}/><Route path="admin/inventory" element={<AdminInventory/>}/><Route path="admin/products" element={<AdminProducts/>}/><Route path="admin/users" element={<AdminApprovals view="directory"/>}/><Route path="admin/users/history" element={<AdminAccountHistory/>}/><Route path="admin/queue" element={<AdminQueue/>}/><Route path="admin/reports" element={<AdminReports/>}/><Route path="admin/settings" element={<AdminSettings/>}/></Route>
  <Route path="*" element={<Navigate to={ROOT} replace/>}/>
</Routes></DemoProvider>}
