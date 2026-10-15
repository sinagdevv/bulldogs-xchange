import {useMemo,useState} from "react";
import {Empty,PageHeader,Stat,StatusBadge} from "../components";
import {Icon} from "../icons";
import {formatPeso} from "../format";
import {ago,dayKey,peso,when} from "./format";
import {TRANSITIONS,balanceDueAtPickup,isActive,lineSummary,queueEntryFor,studentOf,totalOf,unitsOf} from "./engine";
import {useDemo} from "./store-context";
import {useRun} from "./hooks";
import {ALL_DATES,matchesDate,type DateFilterValue} from "./reports";
import {ConfirmDialog,DateFilter,DemoNote,PaymentBadge,Tabs} from "./ui";
import {STATUS_ORDER} from "./reports";
import type {DemoReservation,DownPaymentStatus,QueueEntry,QueueStatus,ResStatus} from "./types";

const NEXT:Partial<Record<ResStatus,{to:ResStatus;label:string;verb:string}>>={
  Pending:{to:"Confirmed",label:"Confirm",verb:"Confirm this reservation"},
  Confirmed:{to:"Preparing",label:"Start preparing",verb:"Start preparing this order"},
  Preparing:{to:"Ready for Pickup",label:"Mark ready",verb:"Mark this order ready for pickup"},
};
const newest=(a:DemoReservation,b:DemoReservation)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt);
type Persona="staff"|"admin";
const useWho=(role:Persona="staff")=>{const{state}=useDemo();return{state,me:state.staff.find(s=>s.id===state.personas[role])!}};

export function StaffHome(){
  const{state}=useWho(),today=dayKey(state.now),by=(s:ResStatus)=>state.reservations.filter(r=>r.status===s).length;
  const waiting=state.queue.filter(q=>q.status==="Waiting").length,serving=state.queue.find(q=>q.status==="Serving");
  const doneToday=state.reservations.filter(r=>r.status==="Completed"&&dayKey(r.updatedAt)===today);
  const open=state.reservations.filter(r=>isActive(r.status)).length,toVerify=state.reservations.filter(r=>isActive(r.status)&&r.downPayment.status==="Awaiting verification").length;
  const events=[...state.audit].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)).slice(0,7);
  return <>
    <PageHeader eyebrow="Staff workspace" title="Operations" description="Today at the NU Fairview Xchange counter."/>
    <div className="stats"><Stat icon="receipt" label="Open reservations" value={open}/><Stat icon="clock" label="Pending confirmation" value={by("Pending")} accent={by("Pending")>0}/><Stat icon="cash" label="Down payments to verify" value={toVerify} foot="Simulated records"/><Stat icon="box" label="Preparing" value={by("Preparing")}/><Stat icon="check" label="Ready for pickup" value={by("Ready for Pickup")}/><Stat icon="queue" label="Queue waiting" value={waiting} foot={serving?`Called ${serving.number}`:"No one called"}/></div>
    <div className="grid-2">
      <section className="panel"><div className="panel-head"><h2>Today's pickups</h2></div><dl className="summary-list"><div><dt>Completed today</dt><dd>{doneToday.length}</dd></div><div><dt>Items released</dt><dd>{doneToday.reduce((n,r)=>n+unitsOf(r),0)}</dd></div><div><dt>Subtotal of released orders</dt><dd>{formatPeso(doneToday.reduce((n,r)=>n+totalOf(r),0))}</dd></div><div><dt>Currently called</dt><dd>{serving?`${serving.number}`:"None"}</dd></div></dl></section>
      <section className="panel flush"><div className="panel-head"><h2>Recent activity</h2></div><div className="list">{events.map(e=><div className="list-row" key={e.id}><div className="main"><strong>{e.message}</strong><small>{e.actor}</small></div><span className="muted">{ago(e.at,state.now)}</span></div>)}</div></section>
    </div><DemoNote/></>;
}

type Filter="attention"|"all"|ResStatus;
type Act={r:DemoReservation;kind:"next"|"cancel"|"queue"|"release"|"verify"|"reject"};
export function StaffReservations(){
  const{state,me}=useWho(),run=useRun(),[tab,setTab]=useState<Filter>("attention"),[q,setQ]=useState(""),[pay,setPay]=useState<DownPaymentStatus|"all">("all"),[date,setDate]=useState<DateFilterValue>(ALL_DATES),[act,setAct]=useState<Act|null>(null);
  const list=useMemo(()=>{const term=q.trim().toLowerCase();return state.reservations.filter(r=>{
    if(tab==="attention"&&!["Pending","Confirmed","Preparing"].includes(r.status))return false;
    if(tab!=="attention"&&tab!=="all"&&r.status!==tab)return false;
    if(pay!=="all"&&r.downPayment.status!==pay)return false;
    if(!matchesDate(date,r.createdAt,state.now))return false;
    if(!term)return true;const s=studentOf(state,r.studentId);return `${r.reference} ${s?.name??""} ${s?.studentId??""}`.toLowerCase().includes(term)}).sort(newest)},[state,tab,q,pay,date]);
  const cnt=(s:ResStatus)=>state.reservations.filter(r=>r.status===s).length,filtersOn=q!==""||pay!=="all"||date.preset!=="all";
  const doIt=()=>{if(!act)return;const{r,kind}=act;
    if(kind==="next")run({type:"transition",reservationId:r.id,to:NEXT[r.status]!.to,actor:me.name,role:"staff"});
    else if(kind==="cancel")run({type:"transition",reservationId:r.id,to:"Cancelled",actor:me.name,role:"staff"});
    else if(kind==="queue")run({type:"joinQueue",reservationId:r.id,actor:me.name});
    else if(kind==="verify")run({type:"verifyPayment",reservationId:r.id,decision:"verify",actor:me.name});
    else if(kind==="reject")run({type:"verifyPayment",reservationId:r.id,decision:"reject",actor:me.name});
    else run({type:"release",reservationId:r.id,actor:me.name});
    setAct(null)};
  const info=act&&(act.kind==="next"?NEXT[act.r.status]!.verb:act.kind==="cancel"?"Cancel this reservation":act.kind==="queue"?"Add this student to the pickup queue":act.kind==="verify"?"Verify the down payment (simulated)":act.kind==="reject"?"Mark the down payment as not verified":"Release items and complete pickup");
  const confirmLabel=!act?"":act.kind==="next"?NEXT[act.r.status]!.label:act.kind==="cancel"?"Cancel reservation":act.kind==="queue"?"Add to queue":act.kind==="verify"?"Verify payment":act.kind==="reject"?"Mark not verified":"Release and complete";
  return <>
    <PageHeader eyebrow="Staff workspace" title="Reservations" description="Move each reservation through confirmation, preparation, and pickup. Reservation status and down payment status are tracked separately."/>
    <Tabs<Filter> label="Reservation status" value={tab} onChange={setTab} tabs={[{id:"attention",label:"Needs action",count:cnt("Pending")+cnt("Confirmed")+cnt("Preparing")},{id:"Ready for Pickup",label:"Ready",count:cnt("Ready for Pickup")},{id:"Completed",label:"Completed",count:cnt("Completed")},{id:"Cancelled",label:"Cancelled",count:cnt("Cancelled")},{id:"all",label:"All",count:state.reservations.length}]}/>
    <section className="filter-panel" aria-label="Filters">
      <label className="search"><span className="sr-only">Search reservations</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search reference, student, or ID"/></label>
      <label className="fp-field"><span>Down payment</span><select value={pay} onChange={e=>setPay(e.target.value as DownPaymentStatus|"all")}><option value="all">All down payment statuses</option>{(["Awaiting payment","Awaiting verification","Verified","Not verified"] as const).map(x=><option key={x}>{x}</option>)}</select></label>
      <div className="fp-field"><span>Reservation date</span><DateFilter value={date} onChange={setDate} now={state.now}/></div>
      <div className="fp-foot"><span className="muted" aria-live="polite">Showing {list.length} reservation{list.length===1?"":"s"}</span>{filtersOn&&<button type="button" className="text-link" onClick={()=>{setQ("");setPay("all");setDate(ALL_DATES)}}>Clear filters</button>}</div>
    </section>
    <section className="panel flush tab-panel" key={tab}>{list.length?<div className="table-wrap"><table className="responsive"><thead><tr><th>Reference</th><th>Student</th><th>Items</th><th className="num">Subtotal</th><th>Down payment</th><th>Reservation</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{list.map(r=>{const s=studentOf(state,r.studentId),e=queueEntryFor(state,r.id),nx=NEXT[r.status],live=isActive(r.status);return <tr key={r.id}>
      <td data-label="Reference" className="mono">{r.reference}</td><td data-label="Student">{s?.name}<span className="sub">{s?.studentId}</span></td><td data-label="Items">{lineSummary(state,r)}</td><td data-label="Subtotal" className="num">{formatPeso(totalOf(r))}</td>
      <td data-label="Down payment">{peso(r.downPayment.amount)}<span className="sub"><PaymentBadge status={r.downPayment.status}/></span></td>
      <td data-label="Reservation"><StatusBadge value={r.status}/>{e&&<span className="sub">Queue {e.number}</span>}</td><td data-label="Updated" className="muted">{ago(r.updatedAt,state.now)}</td>
      <td data-label="Actions"><div className="row-actions">
        {nx&&<button type="button" className="btn btn-sm" onClick={()=>setAct({r,kind:"next"})}>{nx.label}</button>}
        {live&&(r.downPayment.status==="Awaiting verification"||r.downPayment.status==="Awaiting payment")&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>setAct({r,kind:"verify"})}>{r.downPayment.status==="Awaiting payment"?"Record payment":"Verify payment"}</button>}
        {live&&r.downPayment.status==="Awaiting verification"&&<button type="button" className="btn btn-ghost btn-sm" onClick={()=>setAct({r,kind:"reject"})}>Not verified</button>}
        {r.status==="Ready for Pickup"&&!e&&<button type="button" className="btn btn-sm" onClick={()=>setAct({r,kind:"queue"})}>Add to queue</button>}
        {r.status==="Ready for Pickup"&&e?.status==="Serving"&&<button type="button" className="btn btn-sm btn-gold" onClick={()=>setAct({r,kind:"release"})}>Release items</button>}
        {r.status==="Ready for Pickup"&&e?.status==="Waiting"&&<span className="muted">Waiting in queue</span>}
        {TRANSITIONS[r.status].includes("Cancelled")&&<button type="button" className="btn btn-danger-outline btn-sm" onClick={()=>setAct({r,kind:"cancel"})}>Cancel</button>}
      </div></td></tr>})}</tbody></table></div>:<Empty icon="receipt" title="No reservations match." message="Try another tab or clear the filters."/>}</section>
    {act&&<ConfirmDialog title={info!} description={`${act.r.reference} for ${studentOf(state,act.r.studentId)?.name}`} tone={act.kind==="cancel"||act.kind==="reject"?"danger":"primary"} confirmLabel={confirmLabel} onCancel={()=>setAct(null)} onConfirm={doIt}>
      <dl className="summary-list"><div><dt>Items</dt><dd>{lineSummary(state,act.r)}</dd></div><div><dt>Subtotal</dt><dd>{formatPeso(totalOf(act.r))}</dd></div><div><dt>Down payment</dt><dd>{peso(act.r.downPayment.amount)} ({act.r.downPayment.status})</dd></div>
        {act.kind==="release"&&<div className="total"><dt>Collect at counter</dt><dd>{peso(balanceDueAtPickup(act.r))}</dd></div>}
        {act.kind==="cancel"&&<div><dt>Effect</dt><dd>Releases reserved stock. Payment handling follows Xchange office policy.</dd></div>}
        {(act.kind==="verify"||act.kind==="reject")&&<div><dt>Note</dt><dd>Simulated record. No money moves in this preview.</dd></div>}</dl></ConfirmDialog>}
    <DemoNote/></>;
}

/* ---------------- Pickup queue ---------------- */
type Basis="queued"|"reserved"|"pickup";
interface Row{key:string;res:DemoReservation;entry?:QueueEntry}
const QUEUE_LABEL:Record<QueueStatus,string>={Waiting:"Waiting",Serving:"Called",Completed:"Completed",Skipped:"Skipped",Left:"Left queue"};
const BASIS_LABEL:Record<Basis,string>={queued:"Queue entry date",reserved:"Reservation date",pickup:"Pickup (completed) date"};
const weight=(r:Row)=>r.entry?.status==="Serving"?0:r.entry?.status==="Waiting"?1:!r.entry&&r.res.status==="Ready for Pickup"?2:r.entry?.status==="Skipped"&&r.res.status==="Ready for Pickup"?3:!r.entry&&isActive(r.res.status)?4:5;

export function StaffQueue({persona="staff"}:{persona?:Persona}){
  const{state,me}=useWho(persona),run=useRun();
  const[resStatus,setResStatus]=useState<ResStatus|"all">("all"),[queueStatus,setQueueStatus]=useState<QueueStatus|"none"|"all">("all"),[basis,setBasis]=useState<Basis>("queued"),[date,setDate]=useState<DateFilterValue>(ALL_DATES),[q,setQ]=useState(""),[release,setRelease]=useState<string|null>(null);
  const serving=state.queue.find(x=>x.status==="Serving"),waiting=state.queue.filter(x=>x.status==="Waiting").sort((a,b)=>(a.type===b.type?0:a.type==="Express"?-1:1)||Date.parse(a.joinedAt)-Date.parse(b.joinedAt));
  /* One row per queue entry, plus one row for each reservation that has never been queued. Queue status and reservation status stay separate fields. */
  const all=useMemo<Row[]>(()=>{
    const byId=new Map(state.reservations.map(r=>[r.id,r])),rows:Row[]=[];
    for(const e of state.queue){const r=byId.get(e.reservationId);if(r)rows.push({key:e.id,res:r,entry:e})}
    for(const r of state.reservations)if(!state.queue.some(e=>e.reservationId===r.id))rows.push({key:r.id,res:r});
    return rows;
  },[state]);
  const dateOf=(x:Row)=>basis==="queued"?x.entry?.joinedAt:basis==="reserved"?x.res.createdAt:x.res.status==="Completed"?x.res.updatedAt:undefined;
  const rows=useMemo(()=>{const term=q.trim().toLowerCase();return all.filter(x=>{
    if(resStatus!=="all"&&x.res.status!==resStatus)return false;
    if(queueStatus==="none"?!!x.entry:queueStatus!=="all"&&x.entry?.status!==queueStatus)return false;
    if(!matchesDate(date,dateOf(x),state.now))return false;
    if(!term)return true;const s=studentOf(state,x.res.studentId);return `${x.entry?.number??""} ${x.res.reference} ${s?.name??""} ${s?.studentId??""}`.toLowerCase().includes(term)}).sort((a,b)=>weight(a)-weight(b)||Date.parse(b.entry?.joinedAt??b.res.createdAt)-Date.parse(a.entry?.joinedAt??a.res.createdAt))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[all,state,resStatus,queueStatus,basis,date,q]);
  const filtersOn=resStatus!=="all"||queueStatus!=="all"||basis!=="queued"||date.preset!=="all"||q!=="";
  const clear=()=>{setResStatus("all");setQueueStatus("all");setBasis("queued");setDate(ALL_DATES);setQ("")};
  const relEntry=release?state.queue.find(x=>x.id===release):undefined,relRes=relEntry?state.reservations.find(r=>r.id===relEntry.reservationId):undefined;
  return <>
    <PageHeader eyebrow={persona==="admin"?"Admin workspace":"Staff workspace"} title="Pickup queue" description="Call the next student, release their items at the counter, and review queue activity." action={<button type="button" className="btn" disabled={!!serving||waiting.length===0} onClick={()=>run({type:"callNext",actor:me.name})}>Call next</button>}/>
    <div className="grid-2">
      <section className="panel"><div className="panel-head"><h2>Now called</h2></div>{serving?<div className="queue-ticket"><small>{studentOf(state,serving.studentId)?.name}</small><span className="num">{serving.number}</span><small>{state.reservations.find(r=>r.id===serving.reservationId)?.reference}</small></div>:<p className="muted">No one is at the counter. Call the next student when ready.</p>}
        {serving&&<div className="row" style={{marginTop:12,gap:8}}><button type="button" className="btn btn-gold" onClick={()=>setRelease(serving.id)}>Release items</button><button type="button" className="btn btn-secondary" onClick={()=>run({type:"skip",queueId:serving.id,actor:me.name})}>Skip</button></div>}</section>
      <section className="panel"><div className="panel-head"><h2>Up next</h2><span className="badge">{waiting.length} waiting</span></div>{waiting.length?<ol className="up-next">{waiting.slice(0,4).map((x,i)=><li key={x.id}><span className="mono">{x.number}</span><span>{studentOf(state,x.studentId)?.name}</span>{x.type==="Express"&&<span className="badge warning plain">Express</span>}{i===0&&<span className="muted">Next</span>}</li>)}</ol>:<p className="muted">The waiting line is empty.</p>}</section>
    </div>
    <section className="filter-panel queue-filters" aria-label="Queue filters">
      <label className="search"><span className="sr-only">Search queue</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search reference, student, name, or ID"/></label>
      <label className="fp-field"><span>Reservation status</span><select value={resStatus} onChange={e=>setResStatus(e.target.value as ResStatus|"all")}><option value="all">All reservation statuses</option>{STATUS_ORDER.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
      <label className="fp-field"><span>Queue status</span><select value={queueStatus} onChange={e=>setQueueStatus(e.target.value as QueueStatus|"none"|"all")}><option value="all">All queue statuses</option>{(Object.keys(QUEUE_LABEL) as QueueStatus[]).map(x=><option key={x} value={x}>{QUEUE_LABEL[x]}</option>)}<option value="none">Not in queue</option></select></label>
      <div className="fp-field wide"><span>Date range</span><div className="fp-dates"><label className="select-wrap"><span className="sr-only">Date applies to</span><select value={basis} onChange={e=>setBasis(e.target.value as Basis)}>{(Object.keys(BASIS_LABEL) as Basis[]).map(x=><option key={x} value={x}>{BASIS_LABEL[x]}</option>)}</select></label><DateFilter value={date} onChange={setDate} now={state.now}/></div></div>
      <div className="fp-foot"><span className="muted" aria-live="polite">Showing {rows.length} of {all.length} records{date.preset!=="all"?`. Date filter uses the ${BASIS_LABEL[basis].toLowerCase()}; rows without that date are hidden.`:"."}</span>{filtersOn&&<button type="button" className="text-link" onClick={clear}>Clear filters</button>}</div>
    </section>
    <section className="panel flush tab-panel">{rows.length?<div className="table-wrap"><table className="responsive"><thead><tr><th>Queue no.</th><th>Student</th><th>Reference</th><th>Items</th><th>Reservation</th><th>Queue</th><th>{BASIS_LABEL[basis]}</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(x=>{const{res:r,entry:e}=x,d=dateOf(x),open=queueEntryFor(state,r.id);return <tr key={x.key}>
      <td data-label="Queue no." className="mono">{e?.number??"None"}{e?.type==="Express"&&<span className="sub">Express</span>}</td><td data-label="Student">{studentOf(state,r.studentId)?.name}<span className="sub">{studentOf(state,r.studentId)?.studentId}</span></td><td data-label="Reference" className="mono">{r.reference}</td><td data-label="Items">{lineSummary(state,r)}</td>
      <td data-label="Reservation"><StatusBadge value={r.status}/></td><td data-label="Queue">{e?<StatusBadge value={e.status} label={QUEUE_LABEL[e.status]}/>:<span className="muted">Not in queue</span>}</td><td data-label={BASIS_LABEL[basis]} className="muted">{d?when(d):"Not available"}</td>
      <td data-label="Actions"><div className="row-actions">
        {e?.status==="Serving"&&<button type="button" className="btn btn-sm btn-gold" onClick={()=>setRelease(e.id)}>Release items</button>}
        {e?.status==="Serving"&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>run({type:"skip",queueId:e.id,actor:me.name})}>Skip</button>}
        {e?.status==="Waiting"&&<button type="button" className="btn btn-secondary btn-sm" onClick={()=>run({type:"leaveQueue",queueId:e.id,actor:me.name})}>Remove</button>}
        {r.status==="Ready for Pickup"&&!open&&<button type="button" className="btn btn-sm" onClick={()=>run({type:"joinQueue",reservationId:r.id,actor:me.name})}>{e?.status==="Skipped"?"Re-queue":"Add to queue"}</button>}</div></td></tr>})}</tbody></table></div>:<Empty icon="queue" title="No records match." message="Change the filters or clear them to see every reservation and queue entry." action={filtersOn?<button type="button" className="btn btn-sm" onClick={clear}>Clear filters</button>:undefined}/>}</section>
    {relEntry&&relRes&&<ConfirmDialog title="Release items and complete pickup" description={`${relEntry.number} · ${studentOf(state,relEntry.studentId)?.name}`} confirmLabel="Release and complete" onCancel={()=>setRelease(null)} onConfirm={()=>{run({type:"release",reservationId:relRes.id,actor:me.name});setRelease(null)}}><dl className="summary-list"><div><dt>Reference</dt><dd>{relRes.reference}</dd></div><div><dt>Items</dt><dd>{lineSummary(state,relRes)}</dd></div><div><dt>Down payment</dt><dd>{peso(relRes.downPayment.amount)} ({relRes.downPayment.status})</dd></div><div className="total"><dt>Collect at counter</dt><dd>{peso(balanceDueAtPickup(relRes))}</dd></div></dl></ConfirmDialog>}
    <DemoNote/></>;
}
