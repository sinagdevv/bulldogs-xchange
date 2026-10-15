import {useMemo,useState} from "react";
import {NavLink,useParams} from "react-router-dom";
import {Empty,Modal,PageHeader,ProductWatermark,Stat,StatusBadge} from "../components";
import {Icon} from "../icons";
import {ImageOrPlaceholder} from "../placeholder";
import {formatPeso,reservationCopy} from "../format";
import {ago,firstName,peso,when} from "./format";
import {STUDENT_CANCELLABLE,balanceDueAtPickup,isActive,lineSummary,pickupStatusOf,productOf,productStock,queueEntryFor,reservationOf,stockOf,totalOf,unitsOf,unreadFor,variantOf} from "./engine";
import {badgeText,percentLabel} from "./policy";
import {useDemo} from "./store-context";
import {useRun} from "./hooks";
import {ConfirmDialog,DemoNote,DemoProductCard,PaymentBadge,PaymentLines,StatusTimeline,Tabs} from "./ui";
import {DEMO_ROOT} from "./roles";
import {type DemoReservation,type DemoState} from "./types";
import {SHOWCASE_CATEGORIES,SHOWCASE_TYPES,showcaseItems,type ShowcaseCategory,type ShowcaseType} from "../showcase";

const base=`${DEMO_ROOT}/student`;
const useMe=()=>{const{state}=useDemo();return{state,me:state.students.find(s=>s.id===state.personas.student)!}};
const byNewest=(a:DemoReservation,b:DemoReservation)=>Date.parse(b.createdAt)-Date.parse(a.createdAt);

/** Reservation, down payment, and pickup are three separate statuses. */
function StatusTrio({state,r}:{state:DemoState;r:DemoReservation}){
  return <dl className="status-trio" aria-label="Reservation, down payment, and pickup status">
    <div><dt>Reservation</dt><dd><StatusBadge value={r.status}/></dd></div>
    <div><dt>Down payment</dt><dd><PaymentBadge status={r.downPayment.status}/></dd></div>
    <div><dt>Pickup</dt><dd><StatusBadge value={pickupStatusOf(state,r)}/></dd></div>
  </dl>;
}

/** Cancel action: always visible while a reservation is active, with a clear reason when it is unavailable. */
function CancelControl({r,onAsk,block}:{r:DemoReservation;onAsk():void;block?:boolean}){
  if(!isActive(r.status))return null;
  const ok=STUDENT_CANCELLABLE.includes(r.status),why=`why-${r.id}`;
  return <div className={`cancel-control${block?" block":""}`}>
    <button type="button" className="btn btn-danger-outline" disabled={!ok} aria-describedby={ok?undefined:why} onClick={onAsk}>Cancel reservation</button>
    {!ok&&<p className="cancel-why" id={why}>Cancellation is closed because staff have started preparing this order. Ask the Xchange counter for help.</p>}
  </div>;
}

function CancelDialog({state,r,onClose}:{state:DemoState;r:DemoReservation;onClose():void}){
  const run=useRun(),me=state.students.find(s=>s.id===r.studentId)!,dp=r.downPayment;
  const payment=dp.status==="Verified"?`Your down payment of ${peso(dp.amount)} is recorded as verified (demo). Whether it is refunded or credited is decided by the Xchange office. No refund is guaranteed in this preview.`
    :dp.status==="Awaiting verification"?`You reported a down payment of ${peso(dp.amount)} (simulated). It has not been verified. No refund is guaranteed in this preview.`
    :"No down payment has been recorded for this reservation, so nothing has been paid.";
  return <ConfirmDialog title="Are you sure you want to cancel this reservation?" description={`${r.reference}: ${lineSummary(state,r)}`} tone="danger" confirmLabel="Yes, cancel reservation" cancelLabel="Keep reservation" onCancel={onClose} onConfirm={()=>{run({type:"transition",reservationId:r.id,to:"Cancelled",actor:me.name,role:"student"});onClose()}}>
    <ul className="consequences"><li>The reserved units are released immediately for other students.</li><li>{payment}</li><li>This cannot be undone, but you can reserve the item again if stock is available.</li></ul>
  </ConfirmDialog>;
}

export function StudentHome(){
  const{state,me}=useMe(),run=useRun();
  const mine=state.reservations.filter(r=>r.studentId===me.id).sort(byNewest),active=mine.filter(r=>isActive(r.status)),ready=active.filter(r=>r.status==="Ready for Pickup");
  const ticket=state.queue.find(q=>q.studentId===me.id&&(q.status==="Waiting"||q.status==="Serving")),focus=ready[0]??active[0];
  const notes=state.notifications.filter(n=>n.studentId===me.id).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)),unread=unreadFor(state,me.id);
  const owing=active.find(r=>r.downPayment.status==="Awaiting payment"||r.downPayment.status==="Not verified");
  const next=ticket?{icon:"queue" as const,title:`You are in the queue: ${ticket.number}`,text:ticket.status==="Serving"?"You are being served. Head to the Xchange counter now.":"Watch for your number at the Xchange counter.",to:`${base}/reservations/${ticket.reservationId}`,cta:"View queue status"}
    :ready[0]?{icon:"queue" as const,title:`${ready[0].reference} is ready for pickup`,text:"Come to the NU Fairview Xchange counter and join the pickup queue.",to:`${base}/reservations/${ready[0].id}`,cta:"Join pickup queue"}
    :owing?{icon:"cash" as const,title:`Down payment needed for ${owing.reference}`,text:`The demo policy asks for ${peso(owing.downPayment.amount)} (${percentLabel(owing.downPayment.rate)}) before staff can verify your reservation.`,to:`${base}/reservations/${owing.id}`,cta:"View payment details"}
    :active[0]?{icon:"receipt" as const,title:`${active[0].reference} is ${active[0].status.toLowerCase()}`,text:reservationCopy[active[0].status],to:`${base}/reservations/${active[0].id}`,cta:"Track reservation"}
    :{icon:"shop" as const,title:"Ready to gear up?",text:"Browse official merchandise and reserve it for campus pickup.",to:`${base}/shop`,cta:"Browse merchandise"};
  const featured=state.products.filter(p=>p.featured&&p.active).slice(0,3);
  return <>
    <PageHeader eyebrow="Student account" title={`Welcome, ${firstName(me.name)}`} description="Reserve campus merchandise and track pickup from one place."/>
    <section className="next-step" aria-label="Next step"><span className="ic"><Icon name={next.icon}/></span><div><h2>{next.title}</h2><p>{next.text}</p></div><NavLink className="btn btn-gold" to={next.to}>{next.cta}</NavLink></section>
    <div className="stats"><Stat icon="receipt" label="Active reservations" value={active.length} foot={`${mine.length} total`}/><Stat icon="check" label="Ready for pickup" value={ready.length} foot="Bring your school ID"/><Stat icon="queue" label="Queue number" value={ticket?.number??"None"} foot={ticket?ticket.status==="Serving"?"Called":ticket.status:"Join when an order is ready"}/></div>
    <div className="grid-2">
      <div className="stack">
        {focus&&<section className="panel"><div className="panel-head"><div><h2>Reservation progress</h2><p className="mono">{focus.reference}</p></div><NavLink className="text-link" to={`${base}/reservations/${focus.id}`}>Details<Icon name="arrow"/></NavLink></div><StatusTimeline r={focus}/><StatusTrio state={state} r={focus}/></section>}
        <section className="panel"><div className="panel-head"><h2>Featured merchandise</h2><NavLink className="text-link" to={`${base}/shop`}>View catalog<Icon name="arrow"/></NavLink></div><div className="product-grid compact">{featured.map(p=><DemoProductCard key={p.id} productId={p.id} to={`${base}/shop/${p.id}`}/>)}</div></section>
      </div>
      <div className="stack">
        <section className="panel flush"><div className="panel-head"><h2>Recent reservations</h2><NavLink className="text-link" to={`${base}/reservations`}>History<Icon name="arrow"/></NavLink></div>{mine.length?<div className="list">{mine.slice(0,4).map(r=><NavLink className="list-row" key={r.id} to={`${base}/reservations/${r.id}`}><div className="main"><strong className="mono">{r.reference}</strong><small>{lineSummary(state,r)}</small></div><StatusBadge value={r.status}/></NavLink>)}</div>:<Empty icon="receipt" message="Your reservations will appear here."/>}</section>
        <section className="panel flush"><div className="panel-head"><h2>Notifications{unread>0&&<span className="badge warning plain" style={{marginLeft:8}}>{unread} new</span>}</h2>{unread>0&&<button type="button" className="text-link" onClick={()=>run({type:"markRead",studentId:me.id},{quiet:true})}>Mark all read</button>}</div>{notes.length?<div className="list">{notes.slice(0,4).map(n=><div key={n.id} className={`list-row${n.read?"":" unread"}`}>{!n.read&&<span className="dot" aria-label="Unread"/>}<div className="main"><strong>{n.title}</strong><p>{n.message}</p><small>{ago(n.at,state.now)}</small></div></div>)}</div>:<Empty icon="bell" message="You have no notifications yet."/>}</section>
      </div>
    </div>
    <DemoNote/></>;
}

type Sort="featured"|"name"|"price-asc"|"price-desc";
export function StudentShop(){
  const{state}=useDemo(),[q,setQ]=useState(""),[cat,setCat]=useState<ShowcaseCategory|"">(""),[type,setType]=useState<ShowcaseType|"">(""),[sort,setSort]=useState<Sort>("featured"),[inStock,setInStock]=useState(false);
  const list=useMemo(()=>{
    const term=q.trim().toLowerCase();
    const l=state.products.filter(p=>p.active&&p.imageUrl&&(!cat||cat==="General Merchandise")&&(!type||type===(p.category==="Caps"?"Caps":p.category==="Tote bags"?"Bags":"Shirts"))&&(!term||`${p.title} ${p.sku} ${p.category}`.toLowerCase().includes(term))&&(!inStock||productStock(state,p.id).available>0));
    return l.sort((a,b)=>sort==="name"?a.title.localeCompare(b.title):sort==="price-asc"?a.price-b.price:sort==="price-desc"?b.price-a.price:(Number(b.featured)-Number(a.featured))||a.title.localeCompare(b.title));
  },[state,q,cat,type,sort,inStock]);
  const showcase=useMemo(()=>{const term=q.trim().toLowerCase();return showcaseItems.filter(p=>!p.approved&&(!cat||p.category===cat)&&(!type||p.type===type)&&(!term||`${p.title} ${p.category} ${p.type}`.toLowerCase().includes(term)))},[q,cat,type]);
  const count=list.length+showcase.length;
  return <>
    <PageHeader eyebrow="Bulldogs collection" title="Campus merchandise" description="Browse reviewed demo SKUs and the complete unapproved photo showcase."/>
    <div className="toolbar shop-toolbar"><label className="search"><span className="sr-only">Search merchandise</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search merchandise"/></label>
      <label className="select-wrap"><span className="sr-only">Sort approved products</span><select value={sort} onChange={e=>setSort(e.target.value as Sort)}><option value="featured">Featured first</option><option value="name">Name A to Z</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option></select></label></div>
    <div className="chips toolbar-chips" role="group" aria-label="Filter by category"><button type="button" className="chip" aria-pressed={!cat} onClick={()=>setCat("")}>All</button>{SHOWCASE_CATEGORIES.map(c=><button type="button" key={c} className="chip" aria-pressed={cat===c} onClick={()=>setCat(c)}>{c}</button>)}</div>
    <div className="chips toolbar-chips" role="group" aria-label="Filter by product type"><button type="button" className="chip" aria-pressed={!type} onClick={()=>setType("")}>All types</button>{SHOWCASE_TYPES.map(t=><button type="button" key={t} className="chip" aria-pressed={type===t} onClick={()=>setType(t)}>{t}</button>)}</div>
    <label className="check-line"><input type="checkbox" checked={inStock} onChange={e=>setInStock(e.target.checked)}/>In stock approved items only</label>
    {count?<><p className="result-meta" aria-live="polite">{count} item{count===1?"":"s"}</p><div className="product-grid">{list.map(p=><DemoProductCard key={p.id} productId={p.id} to={`${base}/shop/${p.id}`}/>)}
      {showcase.map(p=><article className={`product-card showcase-card${p.studio?" studio-photo":""}`} key={p.file} tabIndex={0}><div className="product-media"><ProductWatermark/><ImageOrPlaceholder src={p.src} alt={p.title}/></div><div className="product-info"><span className="sku">{p.category} · {p.type}</span><h3>{p.title}</h3><StatusBadge value="Unapproved" label="Unapproved / Showcase only"/></div></article>)}</div></>:<Empty icon="search" title="No matching merchandise." message="Try a different search, category, product type, or turn off the stock filter."/>}
    <DemoNote>Three reviewed SKU mappings remain reservable demo items. All other photos are unapproved showcase-only references with no price, stock, or reservation action.</DemoNote></>;
}

export function StudentProduct(){
  const{productId}=useParams(),{state,me}=useMe(),run=useRun(),p=productOf(state,productId??"");
  const variants=state.variants.filter(v=>v.productId===p?.id),[sel,setSel]=useState<string>(""),[qty,setQty]=useState(1),[confirm,setConfirm]=useState(false),[done,setDone]=useState<string>(""),[limit,setLimit]=useState<null|"limit"|"stock">(null);
  if(!p||!p.active||!p.imageUrl)return <Empty icon="search" title="Product not approved." message="Only merchandise with a verified SKU image mapping is available in this demo." action={<NavLink className="btn" to={`${base}/shop`}>Back to shop</NavLink>}/>;
  const maxUnits=state.settings.maxUnitsPerItem,rate=state.settings.downPaymentRate;
  const chosen=sel&&variants.some(v=>v.id===sel)?sel:(variants.find(v=>stockOf(state,v.id).available>0)??variants[0]!).id,st=stockOf(state,chosen),v=variantOf(state,chosen)!;
  const max=Math.max(0,Math.min(maxUnits,st.available)),q=Math.min(Math.max(1,qty),Math.max(1,max)),cls=st.available<=0?"out":st.status==="Low Stock"?"low":"";
  const doneRes=done?reservationOf(state,done):undefined,subtotal=p.price*q;
  const more=()=>{if(q>=max){setLimit(st.available<maxUnits?"stock":"limit")}else setQty(q+1)};
  const reserve=()=>{const r=run({type:"reserve",studentId:me.id,variantId:chosen,qty:q});setConfirm(false);if(r.ok&&r.created)setDone(r.created)};
  return <>
    <nav className="breadcrumb" aria-label="Breadcrumb"><NavLink to={`${base}/shop`}>Shop</NavLink><Icon name="chevron"/><span>{p.title}</span></nav>
    <div className="pdp"><div className="product-media"><ProductWatermark/><ImageOrPlaceholder src={p.imageUrl} alt={p.title} category={p.title} aspect="1/1" size="lg"/></div>
      <div className="pdp-info"><div><span className="eyebrow">{p.category}</span><h1 style={{marginTop:8}}>{p.title}</h1></div><div className="pdp-price price">{formatPeso(p.price)}</div><p className="muted">{p.description}</p>
        <div className="pdp-section"><span className="field-label" id="size-label">{variants.length>1?"Size":"Option"}</span><div className="option-group" role="radiogroup" aria-labelledby="size-label">{variants.map(o=>{const s=stockOf(state,o.id);return <label className="option" key={o.id}><input type="radio" name="variant" value={o.id} checked={chosen===o.id} disabled={s.available<=0} onChange={()=>{setSel(o.id);setQty(1)}}/><span>{o.name}</span></label>})}</div>
          <span className={`availability ${cls}`}><i className="dot"/>{st.available<=0?"Out of stock":st.status==="Low Stock"?`Low stock: ${st.available} left`:`${st.available} available`}</span></div>
        <div className="pdp-section"><span className="field-label">Quantity</span><div className="stepper"><button type="button" aria-label="Decrease quantity" disabled={q<=1} onClick={()=>setQty(q-1)}>-</button><input aria-label="Quantity" value={q} readOnly/><button type="button" aria-label="Increase quantity" disabled={max<1} onClick={more}>+</button></div>
          <span className="hint">Limit: up to {maxUnits} unit{maxUnits===1?"":"s"} of this item per reservation (preview policy).</span></div>
        <PaymentLines subtotal={subtotal} rate={rate}/>
        {doneRes?<div className="notice success" role="status"><Icon name="check"/><div><strong>{doneRes.reference} reserved</strong><p>Your reservation is Pending. Your down payment is <b>{doneRes.downPayment.status}</b>: nothing has been paid yet, and no payment was processed.</p><StatusTrio state={state} r={doneRes}/><NavLink className="text-link" to={`${base}/reservations/${doneRes.id}`}>See payment instructions and track this reservation<Icon name="arrow"/></NavLink></div></div>
          :<button type="button" className="btn btn-lg" disabled={max<1} onClick={()=>setConfirm(true)}>{max<1?"Out of stock":"Reserve for campus pickup"}</button>}
        <div className="notice"><Icon name="info"/><p>Reserving does not pay for the item. The down payment is a demo policy ({percentLabel(rate)}), the balance is paid at the Xchange counter, and no online payment is processed.</p></div></div></div>
    {confirm&&<ConfirmDialog title="Confirm reservation" description="Review your selection and down payment before reserving." confirmLabel="Confirm reservation" onConfirm={reserve} onCancel={()=>setConfirm(false)}>
      <dl className="summary-list"><div><dt>Item</dt><dd>{p.title}</dd></div>{v.name!=="Standard"&&<div><dt>Size</dt><dd>{v.name}</dd></div>}<div><dt>Quantity</dt><dd>{q}</dd></div></dl>
      <PaymentLines subtotal={subtotal} rate={rate}/>
      <p className="muted small">After you reserve, the down payment status is <b>Awaiting payment</b>. It becomes verified only after staff confirm it.</p></ConfirmDialog>}
    {limit&&<Modal role="alertdialog" title="Reservation limit reached" description={limit==="limit"?`You can reserve up to ${maxUnits} unit${maxUnits===1?"":"s"} of this item.`:`Only ${st.available} unit${st.available===1?" is":"s are"} available in this size.`} onClose={()=>setLimit(null)} footer={<button type="button" className="btn" autoFocus onClick={()=>setLimit(null)}>Got it</button>}>
      <p className="muted">{limit==="limit"?"This per-item limit keeps limited merchandise available for other students. It is a preview policy that an Admin can configure, and it is not enforced on the live system.":"The quantity cannot exceed the stock on hand for the size you selected. Choose another size or check back after stock is replenished."}</p></Modal>}</>;
}

type HistTab="all"|"active"|"ready"|"completed"|"cancelled";
export function StudentReservations(){
  const{state,me}=useMe(),[tab,setTab]=useState<HistTab>("all"),[ask,setAsk]=useState<DemoReservation|null>(null),mine=state.reservations.filter(r=>r.studentId===me.id).sort(byNewest);
  const match=(r:DemoReservation)=>tab==="all"||(tab==="active"?isActive(r.status):tab==="ready"?r.status==="Ready for Pickup":tab==="completed"?r.status==="Completed":r.status==="Cancelled"||r.status==="Expired");
  const shown=mine.filter(match),n=(t:HistTab)=>mine.filter(r=>t==="all"||(t==="active"?isActive(r.status):t==="ready"?r.status==="Ready for Pickup":t==="completed"?r.status==="Completed":r.status==="Cancelled"||r.status==="Expired")).length;
  return <>
    <PageHeader eyebrow="My orders" title="Reservation History" description="Every reservation you have made, with its reservation, down payment, and pickup status."/>
    <Tabs<HistTab> label="Reservation filter" value={tab} onChange={setTab} tabs={[{id:"all",label:"All",count:n("all")},{id:"active",label:"Active",count:n("active")},{id:"ready",label:"Ready for pickup",count:n("ready")},{id:"completed",label:"Completed",count:n("completed")},{id:"cancelled",label:"Cancelled",count:n("cancelled")}]}/>
    <section className="panel flush tab-panel" key={tab}>{shown.length?<div className="table-wrap"><table className="responsive history"><thead><tr><th>Reference</th><th>Date</th><th>Merchandise</th><th className="num">Subtotal</th><th>Down payment</th><th>Reservation</th><th>Pickup</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{shown.map(r=><tr key={r.id}>
      <td data-label="Reference" className="mono"><NavLink className="text-link" to={`${base}/reservations/${r.id}`}>{r.reference}</NavLink></td><td data-label="Date">{when(r.createdAt)}</td><td data-label="Items">{lineSummary(state,r)}</td><td data-label="Subtotal" className="num">{formatPeso(totalOf(r))}</td>
      <td data-label="Down payment">{peso(r.downPayment.amount)}<span className="sub"><PaymentBadge status={r.downPayment.status}/></span></td><td data-label="Reservation"><StatusBadge value={r.status}/></td><td data-label="Pickup">{pickupStatusOf(state,r)}</td>
      <td data-label="Actions"><div className="row-actions"><NavLink className="btn btn-secondary btn-sm" to={`${base}/reservations/${r.id}`}>View</NavLink><CancelControl r={r} onAsk={()=>setAsk(r)}/></div></td></tr>)}</tbody></table></div>:<Empty icon="receipt" title="Nothing here." message="Reservations in this view will appear here." action={<NavLink className="btn btn-sm" to={`${base}/shop`}>Browse merchandise</NavLink>}/>}</section>
    {ask&&<CancelDialog state={state} r={ask} onClose={()=>setAsk(null)}/>}<DemoNote/></>;
}

export function StudentReservationDetail(){
  const{id}=useParams(),{state,me}=useMe(),run=useRun(),[cancel,setCancel]=useState(false),r=reservationOf(state,id??"");
  if(!r||r.studentId!==me.id)return <Empty icon="receipt" title="Reservation not found." message="It may have been removed when the demo was reset." action={<NavLink className="btn" to={`${base}/reservations`}>Reservation History</NavLink>}/>;
  const entry=queueEntryFor(state,r.id),waitingAhead=entry&&entry.status==="Waiting"?state.queue.filter(q=>(q.status==="Waiting"&&Date.parse(q.joinedAt)<Date.parse(entry.joinedAt))||q.status==="Serving").length:0;
  const dp=r.downPayment,total=totalOf(r),needsPayment=isActive(r.status)&&(dp.status==="Awaiting payment"||dp.status==="Not verified");
  return <>
    <nav className="breadcrumb" aria-label="Breadcrumb"><NavLink to={`${base}/reservations`}>Reservation History</NavLink><Icon name="chevron"/><span className="mono">{r.reference}</span></nav>
    <PageHeader eyebrow="Reservation" title={r.reference} description={reservationCopy[r.status]} action={<CancelControl r={r} onAsk={()=>setCancel(true)} block/>}/>
    <StatusTrio state={state} r={r}/>
    <section className="panel" aria-live="polite"><StatusTimeline r={r}/></section>
    <div className="grid-2" style={{marginTop:24}}>
      <div className="stack">
        <section className="panel flush"><div className="panel-head"><h2>Items</h2></div><div className="table-wrap"><table><thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Price</th></tr></thead><tbody>{r.lines.map(l=>{const v=variantOf(state,l.variantId)!,p=productOf(state,v.productId)!;return <tr key={l.variantId}><td>{p.title}<span className="sub">{v.name==="Standard"?p.sku:`Size ${v.name}`}</span></td><td className="num">{l.qty}</td><td className="num">{formatPeso(l.qty*l.unitPrice)}</td></tr>})}</tbody><tfoot><tr><td><strong>Subtotal</strong></td><td className="num">{unitsOf(r)}</td><td className="num"><strong>{formatPeso(total)}</strong></td></tr></tfoot></table></div></section>
        <section className="panel flush"><div className="panel-head"><h2>Status history</h2></div><div className="list">{[...r.history].reverse().map((h,i)=><div className="list-row" key={i}><div className="main"><strong>{h.status}</strong><small>{h.note??`Updated by ${h.by}`}</small></div><span className="muted">{when(h.at)}</span></div>)}</div></section>
      </div>
      <div className="stack">
        <section className="panel"><div className="panel-head"><h2>Down payment</h2><PaymentBadge status={dp.status}/></div>
          <PaymentLines subtotal={total} rate={dp.rate} amount={dp.amount} verified={dp.status==="Verified"}/>
          {needsPayment&&<><div className="notice"><Icon name="info"/><div><strong>How to pay (demo instructions)</strong><p>Bring or send the down payment to the Bulldogs Xchange counter and quote <b className="mono">{r.reference}</b>. Staff then verify it. The Xchange office will confirm the real payment channel before launch.</p></div></div>
            <button type="button" className="btn btn-secondary btn-block" style={{marginTop:12}} onClick={()=>run({type:"acknowledgePayment",reservationId:r.id,actor:me.name})}>I have sent my down payment (simulated)</button>
            <p className="muted small">Simulated acknowledgement only. It does not pay anything and does not mark the payment as verified.</p></>}
          {dp.status==="Awaiting verification"&&<p className="muted small" style={{marginTop:12}}>You reported a down payment. It stays unverified until staff confirm it. This is a simulated record.</p>}
          {dp.status==="Verified"&&<p className="muted small" style={{marginTop:12}}>Staff verified this down payment (simulated record). The remaining balance is paid at the counter when you pick up.</p>}
        </section>
        <section className="panel"><div className="panel-head"><h2>Pickup</h2><StatusBadge value={pickupStatusOf(state,r)}/></div>
          <dl className="summary-list"><div><dt>Where</dt><dd>NU Fairview Xchange counter</dd></div><div><dt>Bring</dt><dd>School ID and your balance</dd></div><div><dt>Balance due at pickup</dt><dd>{isActive(r.status)?peso(balanceDueAtPickup(r)):r.status==="Completed"?"Settled":"Not applicable"}</dd></div><div><dt>Reserved until</dt><dd>{when(r.expiresAt)}</dd></div></dl>
          {r.status==="Ready for Pickup"&&(entry?<><div className="queue-ticket" style={{marginTop:12}}><small>{entry.status==="Serving"?"Now serving you":"Your queue number"}</small><span className="num">{entry.number}</span><small>{entry.status==="Serving"?"Head to the Xchange counter":waitingAhead===0?"You are next":`${waitingAhead} ahead of you`}</small></div>{entry.status==="Waiting"&&<button type="button" className="btn btn-secondary btn-block" style={{marginTop:12}} onClick={()=>run({type:"leaveQueue",queueId:entry.id,actor:me.name})}>Leave queue</button>}</>:<button type="button" className="btn btn-block" style={{marginTop:12}} onClick={()=>run({type:"joinQueue",reservationId:r.id,actor:me.name})}>Join pickup queue</button>)}
        </section>
      </div></div>
    {cancel&&<CancelDialog state={state} r={r} onClose={()=>setCancel(false)}/>}</>;
}

export function StudentNotifications(){
  const{state,me}=useMe(),run=useRun(),notes=state.notifications.filter(n=>n.studentId===me.id).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)),unread=unreadFor(state,me.id),cap=state.settings.notificationBadgeCap;
  return <>
    <PageHeader eyebrow="My orders" title="Notifications" description={unread>0?`You have ${badgeText(unread,cap)} unread notification${unread===1?"":"s"}.`:"You are all caught up."} action={unread>0?<button type="button" className="btn btn-secondary btn-sm" onClick={()=>run({type:"markRead",studentId:me.id},{quiet:true})}>Mark all as read</button>:undefined}/>
    <section className="panel flush">{notes.length?<div className="list">{notes.map(n=><NavLink key={n.id} to={n.reservationId?`${base}/reservations/${n.reservationId}`:base} onClick={()=>{if(!n.read)run({type:"markRead",studentId:me.id,notificationId:n.id},{quiet:true})}} className={`list-row${n.read?"":" unread"}`}>{!n.read&&<span className="dot" aria-label="Unread"/>}<div className="main"><strong>{n.title}</strong><p>{n.message}</p><small>{when(n.at)}</small></div><Icon name="chevron"/></NavLink>)}</div>:<Empty icon="bell" title="No notifications." message="Updates about your reservations will appear here."/>}</section><DemoNote/></>;
}
