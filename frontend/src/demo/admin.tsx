import {useMemo,useState} from "react";
import {Link} from "react-router-dom";
import {Brand} from "../brand";
import {Empty,Modal,PageHeader,Stat,StatusBadge} from "../components";
import {Icon} from "../icons";
import {formatPeso} from "../format";
import {BarList,ChartFrame,Columns,LineChart,StackedBar} from "./charts";
import {ago,count,dateAndTime,peso,shortDate,when} from "./format";
import {balanceFor,downPaymentFor,percentLabel,POLICY_DISCLAIMER} from "./policy";
import {productOf,productStock,stockOf,unpickedReservations,unpickedUnits,variantOf} from "./engine";
import {STATUS_COLORS,inventorySummary} from "./admin-data";
import {useDemo} from "./store-context";
import {useRange,useRun} from "./hooks";
import {PRESETS,REPORT_TYPES,dataset,fastMoving,movement,pickupSeries,rangeLabel,rangeToParams,reservationSeries,resolveRange,slowMoving,statusCounts,summary,FAST_N,SLOW_N,type Dataset,type DateRange,type RangePreset} from "./reports";
import {ConfirmDialog,DataTable,DemoNote,StockBadge,Tabs,ViewToggle} from "./ui";
import {CATEGORIES,type Category,type DemoProduct,type DemoStudent,type ProductInput,type StudentStatus} from "./types";
import {StaffQueue} from "./staff";
import {ImageOrPlaceholder} from "../placeholder";

const useAdmin=()=>{const{state}=useDemo();return{state,me:state.staff.find(s=>s.id===state.personas.admin)!}};
const Sim=()=><span className="badge plain sim">Simulated demo data</span>;
export const AdminQueue=()=><StaffQueue persona="admin"/>;

/* ---------------- Overview ---------------- */
export function AdminHome(){
  const{state}=useAdmin(),inv=inventorySummary(state,stockOf);
  const pending=state.students.filter(x=>x.status==="pending").length,completed=state.reservations.filter(r=>r.status==="Completed").length;
  const units=unpickedUnits(state),open=unpickedReservations(state);
  const live=new Set(state.products.filter(p=>p.active).map(p=>p.id));
  const lows=state.variants.filter(v=>live.has(v.productId)).map(v=>({v,st:stockOf(state,v.id)})).filter(x=>x.st.status!=="Healthy").sort((a,b)=>a.st.available-b.st.available).slice(0,5);
  const events=[...state.audit].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,6);
  const range=resolveRange("30d",state.now),series=reservationSeries(state,range);
  return <>
    <PageHeader eyebrow="Admin workspace" title="Overview" description="Reservations, pickups, and inventory at a glance." action={<Sim/>}/>
    {pending>0&&<Link className="notice info approvals-banner" to="/design-preview/admin/approvals"><Icon name="clock"/><span><strong>{pending} student registration{pending===1?"":"s"} awaiting approval.</strong> Review them under User management.</span></Link>}
    <div className="stats"><Stat icon="receipt" label="Total Reservations" value={state.reservations.length} foot="All statuses, all time in demo"/><Stat icon="box" label="Unpicked Items" value={units} foot={`${units===1?"unit":"units"} in ${open} reservation${open===1?"":"s"} awaiting pickup`} accent={units>0}/><Stat icon="clock" label="Active reservations" value={inv.activeReservations} foot="Open at the counter"/><Stat icon="check" label="Completed pickups" value={completed} foot="All time in demo"/></div>
    <div className="grid-2">
      <ChartFrame title="Reservations, last 30 days" note="Simulated demo data" table={<DataTable data={dataset(state,range,"summary")} range={range}/>}><LineChart data={series} label="Reservations per day"/></ChartFrame>
      <section className="panel"><div className="panel-head"><h2>Inventory summary</h2></div><dl className="summary-list"><div><dt>Units on hand</dt><dd>{inv.physical}</dd></div><div><dt>Reserved</dt><dd>{inv.reserved}</dd></div><div><dt>Available</dt><dd>{inv.available}</dd></div><div><dt>Low-stock variants</dt><dd>{inv.low}</dd></div><div><dt>Out of stock</dt><dd>{inv.out}</dd></div></dl></section>
    </div>
    <div className="grid-2" style={{marginTop:24}}>
      <section className="panel flush"><div className="panel-head"><h2>Low stock</h2></div>{lows.length?<div className="list">{lows.map(({v,st})=><div className="list-row" key={v.id}><div className="main"><strong>{productOf(state,v.productId)?.title}</strong><small>{v.name==="Standard"?"Standard":`Size ${v.name}`} · {st.available} available</small></div><StockBadge status={st.status}/></div>)}</div>:<Empty icon="box" message="Everything is above its reorder level."/>}</section>
      <section className="panel flush"><div className="panel-head"><h2>Recent activity</h2></div><div className="list">{events.map(e=><div className="list-row" key={e.id}><div className="main"><strong>{e.message}</strong><small>{e.actor}</small></div><span className="muted">{ago(e.at,state.now)}</span></div>)}</div></section>
    </div><DemoNote/></>;
}

/* ---------------- User management ---------------- */
type Dialog={kind:"approve"|"reject"|"suspend"|"restore"|"history";s:DemoStudent}|null;
export function AdminApprovals({view="approvals"}:{view?:"approvals"|"directory"}){
  const{state,me}=useAdmin(),run=useRun(),[tab,setTab]=useState<StudentStatus|"all">(()=>view==="approvals"||state.students.some(x=>x.status==="pending")?"pending":"all"),[q,setQ]=useState(""),[d,setD]=useState<Dialog>(null),[reason,setReason]=useState("");
  const counts=(s:StudentStatus|"all")=>s==="all"?state.students.length:state.students.filter(x=>x.status===s).length;
  const rows=useMemo(()=>{const t=q.trim().toLowerCase();return state.students.filter(s=>(tab==="all"||s.status===tab)&&(!t||`${s.name} ${s.studentId}`.toLowerCase().includes(t))).sort((a,b)=>Date.parse(b.registeredAt)-Date.parse(a.registeredAt))},[state,tab,q]);
  const close=()=>{setD(null);setReason("")};
  const needReason=d?.kind==="reject"||d?.kind==="suspend",ok=!needReason||reason.trim().length>=5;
  const confirm=()=>{if(!d||d.kind==="history")return;const r=run({type:"decideStudent",studentId:d.s.id,decision:d.kind,actor:me.name,reason:needReason?reason.trim():undefined});if(r.ok)close()};
  const history=[...state.audit].filter(a=>a.kind==="account").sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,12);
  const hist=d?.kind==="history"?state.audit.filter(a=>a.kind==="account"&&a.ref===d.s.id).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)):[];
  const labels:Record<string,string>={approve:"Approve",reject:"Reject",suspend:"Suspend",restore:"Restore"};
  return <>
    <PageHeader eyebrow="User management" title="Students" description="Review pending registrations, then approve, reject, suspend, or restore access. Students cannot reserve until approved."/>
    <Tabs<StudentStatus|"all"> label="Account status" value={tab} onChange={setTab} tabs={[{id:"all",label:"All students",count:counts("all")},{id:"pending",label:"Pending",count:counts("pending")},{id:"approved",label:"Approved",count:counts("approved")},{id:"rejected",label:"Rejected",count:counts("rejected")},{id:"suspended",label:"Suspended",count:counts("suspended")}]}/>
    <div className="toolbar"><label className="search"><span className="sr-only">Search students</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by name or student ID"/></label></div>
    <section className="panel flush tab-panel" key={tab}>{rows.length?<div className="table-wrap"><table className="responsive"><thead><tr><th>Student</th><th>ID</th><th>Program</th><th>{tab==="pending"?"Registered":"Decided"}</th>{tab!=="pending"&&tab!=="approved"&&<th>Reason</th>}<th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(s=><tr key={s.id}>
      <td data-label="Student">{s.name}<span className="sub">{s.email}</span>{tab==="all"&&<span className="sub">Status: {s.status[0]!.toUpperCase()+s.status.slice(1)}</span>}</td><td data-label="ID" className="mono">{s.studentId}</td><td data-label="Program">{s.program}<span className="sub">Year {s.year}</span></td><td data-label={tab==="pending"?"Registered":"Decided"}>{shortDate(tab==="pending"?s.registeredAt:s.decidedAt??s.registeredAt)}{s.decidedBy&&tab!=="pending"&&<span className="sub">by {s.decidedBy}</span>}</td>{tab!=="pending"&&tab!=="approved"&&<td data-label="Reason">{s.reason??"None recorded"}</td>}
      <td data-label="Actions"><div className="row-actions">
        {s.status==="pending"&&<><button type="button" className="btn btn-sm" onClick={()=>setD({kind:"approve",s})}>Approve</button><button type="button" className="btn btn-secondary btn-sm" onClick={()=>setD({kind:"reject",s})}>Reject</button></>}
        {s.status==="approved"&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>setD({kind:"suspend",s})}>Suspend</button>}
        {s.status==="suspended"&&<button type="button" className="btn btn-sm" onClick={()=>setD({kind:"restore",s})}>Restore</button>}
        {s.status==="rejected"&&<button type="button" className="btn btn-sm" onClick={()=>setD({kind:"approve",s})}>Approve</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={()=>setD({kind:"history",s})}>History</button></div></td></tr>)}</tbody></table></div>:<Empty icon="users" title="No students here." message="Try another tab or clear the search."/>}</section>
    <section className="panel flush" style={{marginTop:24}}><div className="panel-head"><h2>Recent account decisions</h2></div><div className="list">{history.map(a=><div className="list-row" key={a.id}><div className="main"><strong>{a.message}</strong><small>{a.actor}</small></div><span className="muted">{when(a.at)}</span></div>)}</div></section>
    {d&&d.kind!=="history"&&<ConfirmDialog title={`${labels[d.kind]} ${d.s.name}?`} description={d.s.studentId} tone={d.kind==="reject"||d.kind==="suspend"?"danger":"primary"} confirmLabel={labels[d.kind]} disabled={!ok} onCancel={close} onConfirm={confirm}>
      {needReason?<div className="field"><label htmlFor="reason">Reason (shown to the student)</label><textarea id="reason" rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="At least 5 characters"/></div>:<p className="muted">{d.kind==="approve"?"The student will be able to reserve merchandise right away.":"The student will regain access to reservations."}</p>}</ConfirmDialog>}
    {d?.kind==="history"&&<Modal title="Approval history" description={`${d.s.name} · ${d.s.studentId}`} onClose={close} footer={<button type="button" className="btn" onClick={close}>Close</button>}>{hist.length?<div className="list">{hist.map(a=><div className="list-row" key={a.id}><div className="main"><strong>{a.message}</strong><small>{a.actor}</small></div><span className="muted">{when(a.at)}</span></div>)}</div>:<p className="muted">No decisions recorded yet.</p>}</Modal>}
    <DemoNote/></>;
}


export function AdminAccountHistory(){
  const{state}=useAdmin(),[q,setQ]=useState("");
  const rows=useMemo(()=>{const t=q.trim().toLowerCase();return state.audit.filter(a=>a.kind==="account"&&(!t||a.message.toLowerCase().includes(t)||a.actor.toLowerCase().includes(t))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))},[state,q]);
  return <>
    <PageHeader eyebrow="User management" title="Account history" description="Every approval, rejection, suspension, and restoration recorded in the demo."/>
    <div className="toolbar"><label className="search"><span className="sr-only">Search history</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search by student or admin"/></label><span className="muted" aria-live="polite">{rows.length} record{rows.length===1?"":"s"}</span></div>
    <section className="panel flush">{rows.length?<div className="list">{rows.map(a=><div className="list-row" key={a.id}><div className="main"><strong>{a.message}</strong><small>{a.actor}</small></div><span className="muted">{when(a.at)}</span></div>)}</div>:<Empty icon="history" title="No records match." message="Clear the search to see all account decisions."/>}</section><DemoNote/></>;
}

/* ---------------- Products ---------------- */
interface VarForm{key:number;id?:string;name:string;reorder:string;stock:string;used:boolean}
interface Form{id?:string;title:string;category:Category;sku:string;price:string;description:string;featured:boolean;imageUrl:string;variants:VarForm[]}
const blank=():Form=>({title:"",category:"T-shirts",sku:"",price:"",description:"",featured:false,imageUrl:"",variants:[{key:1,name:"Standard",reorder:"5",stock:"20",used:false}]});
const SKU_RE=/^[A-Z0-9][A-Z0-9-]{1,23}$/;
function validate(f:Form){
  const e:Record<string,string>={},sku=f.sku.trim().toUpperCase(),price=Number(f.price);
  if(f.title.trim().length<2||f.title.trim().length>80)e.title="Enter a name of 2 to 80 characters.";
  if(!SKU_RE.test(sku))e.sku="Use 2 to 24 letters, numbers, or hyphens.";
  if(!f.price||!Number.isFinite(price)||price<=0||price>99999)e.price="Enter a price greater than 0.";
  if(f.description.length>300)e.description="Keep the description under 300 characters.";
  if(f.imageUrl&&!/^\/[\w./-]+$/.test(f.imageUrl))e.imageUrl="Use a local path such as /images/tee.jpg, or leave empty for the placeholder.";
  const names=f.variants.map(v=>v.name.trim().toLowerCase());
  if(!f.variants.length)e.variants="Add at least one variant or size.";
  else if(f.variants.some(v=>!v.name.trim()||v.name.trim().length>20))e.variants="Each variant needs a name of up to 20 characters.";
  else if(new Set(names).size!==names.length)e.variants="Variant names must be unique.";
  else if(f.variants.some(v=>!/^\d+$/.test(v.reorder)||(!v.id&&!/^\d+$/.test(v.stock))))e.variants="Reorder level and stock must be whole numbers, 0 or more.";
  return e;
}
export function AdminProducts(){
  const{state,me}=useAdmin(),run=useRun(),[q,setQ]=useState(""),[cat,setCat]=useState<Category|"">(""),[tab,setTab]=useState<"active"|"archived"|"all">("active"),[form,setForm]=useState<Form|null>(null),[touched,setTouched]=useState(false),[err,setErr]=useState(""),[del,setDel]=useState<DemoProduct|null>(null),[arch,setArch]=useState<DemoProduct|null>(null);
  const rows=useMemo(()=>{const t=q.trim().toLowerCase();return state.products.filter(p=>(tab==="all"||(tab==="active")===p.active)&&(!cat||p.category===cat)&&(!t||`${p.title} ${p.sku}`.toLowerCase().includes(t)))},[state,q,cat,tab]);
  const nActive=state.products.filter(p=>p.active).length;
  const openNew=()=>{setForm(blank());setTouched(false);setErr("")};
  const openEdit=(p:DemoProduct)=>{const vs=state.variants.filter(v=>v.productId===p.id);setForm({id:p.id,title:p.title,category:p.category,sku:p.sku,price:String(p.price),description:p.description,featured:p.featured,imageUrl:p.imageUrl??"",variants:vs.map((v,i)=>({key:i+1,id:v.id,name:v.name,reorder:String(v.reorder),stock:String(v.physical),used:state.reservations.some(r=>r.lines.some(l=>l.variantId===v.id))}))});setTouched(false);setErr("")};
  const errors=form?validate(form):{};
  const save=()=>{if(!form)return;setTouched(true);if(Object.keys(errors).length)return;
    const input:ProductInput={...(form.id?{id:form.id}:{}),title:form.title.trim(),category:form.category,sku:form.sku.trim().toUpperCase(),description:form.description.trim(),price:Number(form.price),featured:form.featured,...(form.imageUrl?{imageUrl:form.imageUrl}:{}),variants:form.variants.map(v=>({...(v.id?{id:v.id}:{}),name:v.name.trim(),reorder:Number(v.reorder),...(v.id?{}:{initialStock:Number(v.stock)})}))};
    const r=run({type:"saveProduct",product:input,actor:me.name});if(r.ok)setForm(null);else setErr(r.message)};
  const setV=(key:number,patch:Partial<VarForm>)=>setForm(f=>f&&{...f,variants:f.variants.map(v=>v.key===key?{...v,...patch}:v)});
  const fe=(k:string)=>touched&&(errors as Record<string,string>)[k]?<p className="field-error" role="alert">{(errors as Record<string,string>)[k]}</p>:null;
  return <>
    <PageHeader eyebrow="Admin workspace" title="Products" description="Add, edit, archive, or delete merchandise. Changes affect demo data only and appear in the student shop immediately." action={<button type="button" className="btn" onClick={openNew}><Icon name="plus"/>Add product</button>}/>
    <Tabs<"active"|"archived"|"all"> label="Product status" value={tab} onChange={setTab} tabs={[{id:"active",label:"Active",count:nActive},{id:"archived",label:"Archived",count:state.products.length-nActive},{id:"all",label:"All",count:state.products.length}]}/>
    <div className="toolbar"><label className="search"><span className="sr-only">Search products</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name or SKU"/></label>
      <label className="select-wrap"><span className="sr-only">Category</span><select value={cat} onChange={e=>setCat(e.target.value as Category|"")}><option value="">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label></div>
    <section className="panel flush tab-panel" key={tab}>{rows.length?<div className="table-wrap"><table className="responsive product-table"><thead><tr><th>Product</th><th>Category</th><th className="num">Price</th><th>Sizes</th><th className="num">Available</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(p=>{const st=productStock(state,p.id),vs=state.variants.filter(v=>v.productId===p.id);return <tr key={p.id} className={p.active?undefined:"is-archived"}>
      <td data-label="Product"><div className="prod-cell"><span className="thumb"><ImageOrPlaceholder src={p.imageUrl} alt="" category={p.title}/></span><span>{p.title}<span className="sub mono">{p.sku}</span></span></div></td><td data-label="Category">{p.category}</td><td data-label="Price" className="num">{formatPeso(p.price)}</td><td data-label="Sizes">{vs.map(v=>v.name).join(", ")}</td><td data-label="Available" className="num">{st.available}</td>
<td data-label="Status">{p.imageUrl?<StatusBadge value={p.active?"Active":"Archived"}/>:<StatusBadge value="Unapproved"/>}{!p.imageUrl&&<span className="sub">Not purchasable · image mapping required</span>}</td>
      <td data-label="Actions"><div className="row-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={()=>openEdit(p)}>Edit</button>{p.active?<button type="button" className="btn btn-secondary btn-sm" onClick={()=>setArch(p)}>Archive</button>:<button type="button" className="btn btn-sm" onClick={()=>run({type:"archiveProduct",productId:p.id,archived:false,actor:me.name})}>Restore</button>}<button type="button" className="btn btn-danger-outline btn-sm" onClick={()=>setDel(p)}>Delete</button></div></td></tr>})}</tbody></table></div>:<Empty icon="tag" title="No products match." message="Change the filters or add a product."/>}</section>
    {form&&<Modal title={form.id?"Edit product":"Add product"} description="Mock catalog only. Nothing is written to the live store." wide onClose={()=>setForm(null)} footer={<><button type="button" className="btn btn-secondary" onClick={()=>setForm(null)}>Cancel</button><button type="button" className="btn" onClick={save}>{form.id?"Save changes":"Add product"}</button></>}>
      {err&&<p className="field-error" role="alert">{err}</p>}
      <div className="form-grid">
        <div className="field"><label htmlFor="pf-title">Product name</label><input id="pf-title" value={form.title} maxLength={80} onChange={e=>setForm({...form,title:e.target.value})} aria-invalid={touched&&!!errors.title}/>{fe("title")}</div>
        <div className="field"><label htmlFor="pf-cat">Category</label><select id="pf-cat" value={form.category} onChange={e=>setForm({...form,category:e.target.value as Category})}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        <div className="field"><label htmlFor="pf-sku">SKU</label><input id="pf-sku" value={form.sku} onChange={e=>setForm({...form,sku:e.target.value.toUpperCase()})} placeholder="NU-TEE-01" aria-invalid={touched&&!!errors.sku}/>{fe("sku")}</div>
        <div className="field"><label htmlFor="pf-price">Price (PHP)</label><input id="pf-price" inputMode="decimal" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="450" aria-invalid={touched&&!!errors.price}/>{fe("price")}</div>
      </div>
      <div className="field"><label htmlFor="pf-desc">Description</label><textarea id="pf-desc" rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/>{fe("description")}</div>
      <div className="field"><label htmlFor="pf-img">Image path (optional)</label><input id="pf-img" value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})} placeholder="/images/product.jpg"/><p className="hint">Leave empty to show the placeholder until the product photo is added.</p>{fe("imageUrl")}</div>
      <label className="check"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/>Feature on the student home page</label>
      <fieldset className="variant-set"><legend>Variants and stock</legend>
        {form.variants.map(v=><div className="variant-row" key={v.key}><div className="field"><label htmlFor={`vn-${v.key}`}>Size or variant</label><input id={`vn-${v.key}`} value={v.name} onChange={e=>setV(v.key,{name:e.target.value})}/></div>
          <div className="field"><label htmlFor={`vr-${v.key}`}>Reorder level</label><input id={`vr-${v.key}`} inputMode="numeric" value={v.reorder} onChange={e=>setV(v.key,{reorder:e.target.value})}/></div>
          <div className="field"><label htmlFor={`vs-${v.key}`}>{v.id?"On hand":"Opening stock"}</label><input id={`vs-${v.key}`} inputMode="numeric" value={v.stock} disabled={!!v.id} onChange={e=>setV(v.key,{stock:e.target.value})}/></div>
          <button type="button" className="btn btn-ghost btn-sm" disabled={v.used||form.variants.length<2} title={v.used?"Used by reservations, cannot be removed":undefined} onClick={()=>setForm({...form,variants:form.variants.filter(x=>x.key!==v.key)})}>Remove</button></div>)}
        {fe("variants")}
        <button type="button" className="btn btn-secondary btn-sm" onClick={()=>setForm({...form,variants:[...form.variants,{key:Math.max(0,...form.variants.map(v=>v.key))+1,name:"",reorder:"5",stock:"10",used:false}]})}><Icon name="plus"/>Add variant</button>
        <p className="hint">Change on-hand stock of existing sizes under Inventory.</p></fieldset>
    </Modal>}
    {arch&&<ConfirmDialog title={`Archive ${arch.title}?`} description="Archiving hides the item from students and blocks new reservations." confirmLabel="Archive" onCancel={()=>setArch(null)} onConfirm={()=>{run({type:"archiveProduct",productId:arch.id,archived:true,actor:me.name});setArch(null)}}><p className="muted">Existing reservations keep this item and are not affected. You can restore it at any time.</p></ConfirmDialog>}
    {del&&<ConfirmDialog title={`Delete ${del.title}?`} description="This removes the item from the demo catalog." tone="danger" confirmLabel="Delete product" onCancel={()=>setDel(null)} onConfirm={()=>{run({type:"deleteProduct",productId:del.id,actor:me.name});setDel(null)}}><p className="muted">Items referenced by any reservation cannot be deleted. Archive them instead. Reset Demo restores the original catalog.</p></ConfirmDialog>}
    <DemoNote/></>;
}

/* ---------------- Demo policy ---------------- */
export function AdminSettings(){
  const{state,me}=useAdmin(),run=useRun(),[rate,setRate]=useState(String(Math.round(state.settings.downPaymentRate*1000)/10)),[max,setMax]=useState(String(state.settings.maxUnitsPerItem)),[cap,setCap]=useState(String(state.settings.notificationBadgeCap));
  const r=Number(rate),m=Number(max),c=Number(cap),ok=rate!==""&&r>=0&&r<=100&&Number.isInteger(m)&&m>=1&&m<=20&&Number.isInteger(c)&&c>=1&&c<=99;
  const sample=1000;
  return <>
    <PageHeader eyebrow="System" title="Demo policy" description="Adjust the preview assumptions used across the demo. They are not approved business rules." action={<span className="badge warning plain">Demo only</span>}/>
    <p className="notice warning"><Icon name="alert"/><span>{POLICY_DISCLAIMER}</span></p>
    <section className="panel" style={{maxWidth:640}}><form onSubmit={e=>{e.preventDefault();if(ok)run({type:"updateSettings",settings:{downPaymentRate:r/100,maxUnitsPerItem:m,notificationBadgeCap:c},actor:me.name})}}>
      <div className="field"><label htmlFor="pol-rate">Down payment (% of subtotal)</label><input id="pol-rate" inputMode="decimal" value={rate} onChange={e=>setRate(e.target.value)}/><p className="hint">Currently {percentLabel(state.settings.downPaymentRate)}. On a {formatPeso(sample)} order this is {peso(downPaymentFor(sample,(Number(rate)||0)/100))} with {peso(balanceFor(sample,downPaymentFor(sample,(Number(rate)||0)/100)))} due at pickup.</p></div>
      <div className="field"><label htmlFor="pol-max">Maximum units per item per reservation</label><input id="pol-max" inputMode="numeric" value={max} onChange={e=>setMax(e.target.value)}/><p className="hint">Students who try to go above this see a limit message. Available stock also applies.</p></div>
      <div className="field"><label htmlFor="pol-cap">Notification badge cap</label><input id="pol-cap" inputMode="numeric" value={cap} onChange={e=>setCap(e.target.value)}/><p className="hint">Counts above this show as {cap||"9"}+.</p></div>
      {!ok&&<p className="field-error" role="alert">Down payment must be 0 to 100, the limit 1 to 20, and the cap 1 to 99.</p>}
      <div className="row" style={{gap:8}}><button type="submit" className="btn" disabled={!ok}>Save policy</button></div></form></section>
    <DemoNote>Policy changes apply to new reservations in this preview only and are cleared by Reset Demo.</DemoNote></>;
}

/* ---------------- Analytics ---------------- */
export function RangeBar({range,setRange,now}:{range:DateRange;setRange(r:DateRange):void;now:string}){
  return <div className="range-bar no-print"><div className="seg" role="group" aria-label="Date range">{PRESETS.map(p=><button key={p.id} type="button" aria-pressed={range.preset===p.id} onClick={()=>setRange(p.id==="custom"?{preset:"custom",from:range.from,to:range.to}:resolveRange(p.id as RangePreset,now))}>{p.label}</button>)}</div>
    {range.preset==="custom"&&<div className="date-inputs"><label>From<input type="date" value={range.from} max={range.to} onChange={e=>e.target.value&&setRange(resolveRange("custom",now,{from:e.target.value,to:range.to}))}/></label><label>To<input type="date" value={range.to} min={range.from} onChange={e=>e.target.value&&setRange(resolveRange("custom",now,{from:range.from,to:e.target.value}))}/></label></div>}
    <span className="muted range-label">Showing {rangeLabel(range)}</span></div>;
}
const ptsData=(id:string,title:string,head:string,pts:{label:string;value:number}[],note:string):Dataset=>({id,title,note,headers:["Period",head],rows:pts.map(p=>[p.label,p.value]),totals:["Total",pts.reduce((n,p)=>n+p.value,0)]});
function Card({title,note,children,table,id}:{title:string;note?:string;children:React.ReactNode;table:React.ReactNode;id:string}){
  const[v,setV]=useState<"chart"|"table">("chart");
  return <section className="panel analytics-card" aria-labelledby={`ac-${id}`}><div className="panel-head"><div><h2 id={`ac-${id}`}>{title}</h2>{note&&<p className="muted small">{note}</p>}</div><ViewToggle value={v} onChange={setV} label={title}/></div>{v==="chart"?children:table}</section>;
}
export function AdminAnalytics(){
  const{state}=useAdmin(),{range,setRange,params}=useRange(),sm=summary(state,range),mv=movement(state,range);
  const fast=fastMoving(mv).slice(0,FAST_N),slow=slowMoving(mv).slice(0,SLOW_N),res=reservationSeries(state,range),pick=pickupSeries(state,range);
  const dist=statusCounts(state,range).map(x=>({label:x.status,value:x.count,color:STATUS_COLORS[x.status]}));
  const mvData=(rows:typeof mv,id:string,title:string):Dataset=>({id,title,note:"",headers:["Rank","Item","Units reserved","Units picked up","Trend vs previous period"],rows:rows.map(x=>[x.rank,x.item,x.unitsReserved,x.unitsPickedUp,x.trend]),totals:["","Total",rows.reduce((n,x)=>n+x.unitsReserved,0),rows.reduce((n,x)=>n+x.unitsPickedUp,0),""]});
  const single=range.from===range.to,qs=new URLSearchParams(rangeToParams(range)).toString();
  void params;
  return <>
    <PageHeader eyebrow="Admin workspace" title="Analytics" description="Reservation and merchandise movement for the selected period. Every chart, table, and export uses the same date range." action={<div className="row" style={{gap:8}}><Link className="btn" to={`/design-preview/admin/reports?${qs}`}><Icon name="file"/>Generate report</Link></div>}/>
    <RangeBar range={range} setRange={setRange} now={state.now}/>
    <div className="stats"><Stat icon="receipt" label="Reservations" value={sm.reservations} foot="Created in the period"/><Stat icon="box" label="Units reserved" value={sm.unitsReserved} foot="Excludes cancelled and expired"/><Stat icon="check" label="Completed pickups" value={sm.completedPickups} foot="Released in the period"/><Stat icon="clock" label="Unpicked Items" value={sm.unpickedUnits} foot={`Now, in ${sm.unpickedReservations} reservations`} accent={sm.unpickedUnits>0}/></div>
    <div className="grid-2">
      <Card id="over" title="Reservations over time" note={single?"By hour":"By day"} table={<DataTable data={ptsData("reservations-over-time","Reservations over time","Reservations",res,"")} range={range}/>}><LineChart data={res} label="Reservations over time"/></Card>
      <Card id="status" title="Reservation status" note="Current status of reservations created in the period" table={<DataTable data={dataset(state,range,"status")} range={range}/>}><StackedBar items={dist} label="Reservation status distribution"/></Card>
    </div>
    <div className="grid-2" style={{marginTop:24}}>
      <Card id="fast" title="Fast-moving merchandise" note="Most units reserved in the period" table={<DataTable data={mvData(fast,"fast-moving","Fast-moving merchandise")} range={range}/>}>{fast.length?<BarList items={fast.map(x=>({label:x.item,value:x.unitsReserved}))} unit="units reserved"/>:<Empty icon="box" message="No merchandise was reserved in this period."/>}</Card>
      <Card id="slow" title="Slow-moving merchandise" note="Fewest units reserved among active items" table={<DataTable data={mvData(slow,"slow-moving","Slow-moving merchandise")} range={range}/>}>{slow.length?<BarList items={slow.map(x=>({label:x.item,value:x.unitsReserved}))} unit="units reserved"/>:<Empty icon="box" message="No slow-moving items in this period."/>}</Card>
    </div>
    <div className="grid-2" style={{marginTop:24}}>
      <Card id="pick" title="Pickup completion" note={`${sm.completedPickups} completed in the period`} table={<DataTable data={ptsData("pickup-completion","Pickup completion","Completed pickups",pick,"")} range={range}/>}><Columns data={pick} label="Completed pickups"/></Card>
      <section className="panel"><div className="panel-head"><h2>How movement is measured</h2></div><p className="muted small">Fast-moving and slow-moving use units reserved in the period, with cancelled and expired reservations excluded. A reservation is not a sale. Units picked up are shown separately. The top {FAST_N} are fast-moving and the bottom {SLOW_N} of active items are slow-moving. Trend compares with the previous period of equal length. This is a preview metric awaiting approval.</p></section>
    </div>
    <section className="panel flush" style={{marginTop:24}}><div className="panel-head"><h2>All merchandise</h2><span className="badge plain">{mv.length} items</span></div><DataTable data={{...dataset(state,range,"movement")}} range={range} search label="Merchandise movement"/></section>
    <DemoNote>All figures are simulated demo data and do not represent real campus results.</DemoNote></>;
}

/* ---------------- Reports ---------------- */
type Presentation="both"|"chart"|"table";
interface Spec{type:string;presentation:Presentation;range:DateRange;at:string}
function ReportChart({state,spec}:{state:ReturnType<typeof useDemo>["state"];spec:Spec}){
  const r=spec.range;
  if(spec.type==="summary")return <LineChart data={reservationSeries(state,r)} label="Reservations over time"/>;
  if(spec.type==="status")return <StackedBar items={statusCounts(state,r).map(x=>({label:x.status,value:x.count,color:STATUS_COLORS[x.status]}))} label="Reservation status distribution"/>;
  if(spec.type==="movement"){const rows=movement(state,r).slice(0,8);return <BarList items={rows.map(x=>({label:x.item,value:x.unitsReserved}))} unit="units reserved"/>}
  if(spec.type==="unpicked"){const d=dataset(state,r,"unpicked");return <BarList items={d.rows.slice(0,8).map(x=>({label:`${x[0]} (${x[1]})`,value:Number(x[2])}))} unit="units"/>}
  return null;
}
export function AdminReports(){
  const{state}=useAdmin(),{range,setRange}=useRange(),[type,setType]=useState("summary"),[pres,setPres]=useState<Presentation>("both"),[spec,setSpec]=useState<Spec|null>(null);
  const generate=()=>setSpec({type,presentation:pres,range,at:state.now});
  const data=spec?dataset(state,spec.range,spec.type):null,sm=spec?summary(state,spec.range):null,hasChart=spec?spec.type!=="ledger":false;
  return <>
    <div className="no-print"><PageHeader eyebrow="Admin workspace" title="Reports" description="Choose a report, a period, and how to present it. Print or export the result."/>
      <section className="panel report-form"><div className="field"><label htmlFor="rp-type">Report type</label><select id="rp-type" value={type} onChange={e=>setType(e.target.value)}>{REPORT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select><p className="hint">{REPORT_TYPES.find(t=>t.id===type)?.description}</p></div>
        <div className="field"><span className="label">Date range</span><RangeBar range={range} setRange={setRange} now={state.now}/></div>
        <div className="field"><label htmlFor="rp-pres">Include</label><select id="rp-pres" value={pres} onChange={e=>setPres(e.target.value as Presentation)}><option value="both">Chart and table</option><option value="chart">Chart only</option><option value="table">Table only</option></select></div>
        <div className="row" style={{gap:8}}><button type="button" className="btn" onClick={generate}><Icon name="file"/>Generate report</button><button type="button" className="btn btn-secondary" disabled={!spec} onClick={()=>window.print()}>Print Report</button></div></section></div>
    {!spec&&<div className="no-print"><Empty icon="file" title="No report generated yet." message="Pick a type and a period, then choose Generate report."/></div>}
    {spec&&data&&sm&&<article className="report-sheet" aria-label={`${data.title} report`}>
      <header className="report-head"><Brand size={52}/><div className="report-mark">DEMO DATA</div></header>
      <h2 className="report-title">{data.title}</h2>
      <dl className="report-meta"><div><dt>Period</dt><dd>{rangeLabel(spec.range)}</dd></div><div><dt>Generated</dt><dd>{dateAndTime(spec.at)} (demo clock)</dd></div><div><dt>Prepared for</dt><dd>NU Fairview Xchange office</dd></div></dl>
      <div className="report-metrics"><div><b>{count(sm.reservations)}</b><span>Reservations</span></div><div><b>{count(sm.unitsReserved)}</b><span>Units reserved</span></div><div><b>{count(sm.completedPickups)}</b><span>Completed pickups</span></div><div><b>{count(sm.unpickedUnits)}</b><span>Unpicked items now</span></div></div>
      <p className="muted small">{data.note}</p>
      {spec.presentation!=="table"&&hasChart&&<div className="report-chart"><ReportChart state={state} spec={spec}/></div>}
      {spec.presentation==="chart"&&!hasChart&&<p className="muted">This report has no chart. The table is shown instead.</p>}
      {(spec.presentation!=="chart"||!hasChart)&&<DataTable data={data} range={spec.range} label={data.title}/>}
      <footer className="report-foot"><strong>DEMO DATA.</strong> Simulated records for design review. Not an official institutional report.</footer>
    </article>}
  </>;
}

/* ---------------- Inventory ---------------- */
type StockFilter="all"|"low"|"out";
export function AdminInventory(){
  const{state,me}=useAdmin(),run=useRun(),[q,setQ]=useState(""),[cat,setCat]=useState<Category|"">(""),[f,setF]=useState<StockFilter>("all"),[adj,setAdj]=useState<string|null>(null),[mode,setMode]=useState<"receive"|"correct"|"writeoff">("receive"),[qty,setQty]=useState(10),[note,setNote]=useState("");
  const rows=useMemo(()=>{const t=q.trim().toLowerCase();return state.variants.map(v=>({v,p:productOf(state,v.productId)!,st:stockOf(state,v.id)})).filter(({v,p,st})=>p.active&&(!cat||p.category===cat)&&(!t||`${p.title} ${v.sku} ${v.name}`.toLowerCase().includes(t))&&(f==="all"||(f==="low"?st.status==="Low Stock":st.status==="Out of Stock")))},[state,q,cat,f]);
  const target=adj?variantOf(state,adj):undefined,tst=adj?stockOf(state,adj):undefined,tp=target?productOf(state,target.productId):undefined;
  const preview=!tst?0:mode==="receive"?tst.physical+qty:mode==="writeoff"?tst.physical-qty:qty;
  const invalid=!tst||qty<0||!Number.isInteger(qty)||(mode!=="correct"&&qty<1)||preview<tst.reserved;
  const open=(id:string)=>{setAdj(id);setMode("receive");setQty(10);setNote("")};
  const submit=()=>{if(!adj)return;const r=run({type:"adjustStock",variantId:adj,mode,qty,actor:me.name,note:note.trim()||undefined});if(r.ok)setAdj(null)};
  const recent=[...state.movements].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,8);
  return <>
    <PageHeader eyebrow="Admin workspace" title="Inventory" description="Physical, reserved, and available stock for every variant. Archived products are hidden here. Adjustments apply to demo data only."/>
    <div className="toolbar"><label className="search"><span className="sr-only">Search inventory</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search product, SKU, or size"/></label>
      <label className="select-wrap"><span className="sr-only">Category</span><select value={cat} onChange={e=>setCat(e.target.value as Category|"")}><option value="">All categories</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label></div>
    <div className="chips toolbar-chips" role="group" aria-label="Stock level">{(["all","low","out"] as StockFilter[]).map(x=><button type="button" className="chip" key={x} aria-pressed={f===x} onClick={()=>setF(x)}>{x==="all"?"All":x==="low"?"Low stock":"Out of stock"}</button>)}</div>
    <section className="panel flush">{rows.length?<div className="table-wrap"><table className="responsive"><thead><tr><th>Product</th><th>Variant</th><th className="num">Physical</th><th className="num">Reserved</th><th className="num">Available</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(({v,p,st})=><tr key={v.id}><td data-label="Product">{p.title}<span className="sub">{p.category}</span></td><td data-label="Variant" className="mono">{v.sku}<span className="sub">{v.name}</span></td><td data-label="Physical" className="num">{st.physical}</td><td data-label="Reserved" className="num">{st.reserved}</td><td data-label="Available" className="num"><strong>{st.available}</strong></td><td data-label="Status"><StockBadge status={st.status}/></td><td data-label="Actions"><div className="row-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={()=>open(v.id)}>Adjust</button></div></td></tr>)}</tbody></table></div>:<Empty icon="box" title="No variants match." message="Change the search or filters."/>}</section>
    <section className="panel flush" style={{marginTop:24}}><div className="panel-head"><h2>Recent stock movements</h2></div><div className="list">{recent.map(m=>{const v=variantOf(state,m.variantId),p=v&&productOf(state,v.productId);return <div className="list-row" key={m.id}><div className="main"><strong>{m.type}: {m.change>0?"+":""}{m.change}</strong><small>{p?.title} {v&&v.name!=="Standard"?`(${v.name})`:""} · now {m.resulting} · {m.actor}</small></div><span className="muted">{when(m.at)}</span></div>})}</div></section>
    {adj&&target&&tst&&tp&&<Modal title="Adjust stock" description={`${tp.title}${target.name==="Standard"?"":` · ${target.name}`}`} onClose={()=>setAdj(null)} footer={<><button type="button" className="btn btn-secondary" onClick={()=>setAdj(null)}>Cancel</button><button type="button" className="btn" disabled={invalid} onClick={submit}>Apply adjustment</button></>}>
      <div className="field"><label htmlFor="adj-mode">Adjustment type</label><select id="adj-mode" value={mode} onChange={e=>setMode(e.target.value as typeof mode)}><option value="receive">Receive stock (add)</option><option value="writeoff">Write off (remove)</option><option value="correct">Correct count (set total)</option></select></div>
      <div className="field"><label htmlFor="adj-qty">{mode==="correct"?"Counted physical stock":"Quantity"}</label><input id="adj-qty" type="number" min={0} step={1} value={qty} onChange={e=>setQty(Number(e.target.value))}/></div>
      <div className="field"><label htmlFor="adj-note">Note (optional)</label><input id="adj-note" value={note} onChange={e=>setNote(e.target.value)} placeholder="For example, supplier delivery"/></div>
      <dl className="summary-list"><div><dt>Current physical</dt><dd>{tst.physical}</dd></div><div><dt>Reserved</dt><dd>{tst.reserved}</dd></div><div className="total"><dt>New physical</dt><dd>{preview}</dd></div></dl>
      {preview<tst.reserved&&<p className="field-error" role="alert">Physical stock cannot drop below the {tst.reserved} reserved units.</p>}</Modal>}
    <DemoNote>Stock adjustments change demo data only and are cleared by Reset Demo.</DemoNote></>;
}

