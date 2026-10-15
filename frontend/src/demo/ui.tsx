import {useMemo,useState,type ReactNode} from "react";
import {NavLink} from "react-router-dom";
import {Icon} from "../icons";
import {Modal,ProductWatermark,StatusBadge} from "../components";
import {ImageOrPlaceholder} from "../placeholder";
import {formatPeso,reservationFlow} from "../format";
import {toCsv,downloadCsv,type Cell} from "./csv";
import {csvName,filterRange,resolveRange,type Dataset,type DateFilterValue,type DateRange} from "./reports";
import {downPaymentFor,percentLabel,balanceFor} from "./policy";
import {productOf,productStock} from "./engine";
import {useDemo} from "./store-context";
import {when,peso,count} from "./format";
import type {DemoReservation,DownPaymentStatus} from "./types";

export function Tabs<T extends string>({tabs,value,onChange,label}:{tabs:{id:T;label:string;count?:number}[];value:T;onChange(v:T):void;label:string}){
  return <div className="tabs" role="tablist" aria-label={label}>{tabs.map(t=><button key={t.id} type="button" role="tab" aria-selected={value===t.id} className="tab" onClick={()=>onChange(t.id)}>{t.label}{t.count!==undefined&&<span className="n">{t.count}</span>}</button>)}</div>;
}

const stockLabel=(status:string)=>status==="Healthy"?"In stock":status;
export const StockBadge=({status}:{status:string})=><StatusBadge value={status} label={stockLabel(status)}/>;

export function DemoNote({children}:{children?:ReactNode}){return <p className="demo-note"><Icon name="info"/>{children??"Simulated demo data. All names, IDs, and figures are fictional."}</p>}

export function ConfirmDialog({title,description,confirmLabel,cancelLabel="Cancel",tone="primary",disabled,onConfirm,onCancel,children}:{title:string;description?:ReactNode;confirmLabel:string;cancelLabel?:string;tone?:"primary"|"danger";disabled?:boolean;onConfirm():void;onCancel():void;children?:ReactNode}){
  return <Modal role="alertdialog" title={title} description={description} onClose={onCancel} footer={<><button type="button" className="btn btn-secondary" onClick={onCancel}>{cancelLabel}</button><button type="button" className={`btn${tone==="danger"?" btn-danger":""}`} disabled={disabled} onClick={onConfirm}>{confirmLabel}</button></>}>{children}</Modal>;
}

export function DemoProductCard({productId,to}:{productId:string;to:string}){
  const{state}=useDemo(),p=productOf(state,productId)!,st=productStock(state,p.id);
  return <article className="product-card"><div className="product-media"><ProductWatermark/><ImageOrPlaceholder src={p.imageUrl} alt={p.title} category={p.title}/>{p.featured&&<span className="badge warning plain flag">Featured</span>}</div>
    <div className="product-info"><span className="sku">{p.category}</span><h3><NavLink className="stretched" to={to}>{p.title}</NavLink></h3><div className="card-foot"><span className="price">{formatPeso(p.price)}</span><StockBadge status={st.status}/></div><span className="view-more" aria-hidden="true">View details<Icon name="arrow"/></span></div></article>;
}

/** Reservation progress. Cancelled and expired reservations show an explanation instead of a progress bar. */
export function StatusTimeline({r}:{r:DemoReservation}){
  if(r.status==="Cancelled"||r.status==="Expired"){
    const last=r.history[r.history.length-1]!;
    return <div className="notice warning"><Icon name="alert"/><div><strong>{r.status==="Cancelled"?"Reservation cancelled":"Reservation expired"}</strong><p>{last.note??"Its reserved stock was released."} {when(last.at)}.</p></div></div>;
  }
  const idx=reservationFlow.indexOf(r.status),finished=r.status==="Completed";
  return <ol className="timeline" aria-label="Reservation progress">{reservationFlow.map((s,i)=>{const h=r.history.find(x=>x.status===s);return <li key={s} className={finished||i<idx?"done":i===idx?"current":""} aria-current={i===idx&&!finished?"step":undefined}><span className="node">{(finished||i<idx)&&<Icon name="check"/>}</span><span>{s}</span>{h&&<small>{when(h.at)}</small>}</li>})}</ol>;
}

/* ---------------- Payment, pickup and data helpers ---------------- */

export const PaymentBadge=({status}:{status:DownPaymentStatus})=><StatusBadge value={status}/>;

/** Subtotal, demo down payment, and remaining balance. `amount` overrides the computed down payment for stored reservations. */
export function PaymentLines({subtotal,rate,amount,verified}:{subtotal:number;rate:number;amount?:number;verified?:boolean}){
  const dp=amount??downPaymentFor(subtotal,rate);
  return <dl className="summary-list payment-lines">
    <div><dt>Reservation subtotal</dt><dd>{peso(subtotal)}</dd></div>
    <div><dt>Demo down payment required ({percentLabel(rate)})</dt><dd>{peso(dp)}</dd></div>
    <div className="total"><dt>{verified?"Remaining balance at pickup":"Remaining balance after down payment"}</dt><dd>{peso(balanceFor(subtotal,dp))}</dd></div>
  </dl>;
}

/* ---------------- Sortable data table with totals and CSV export ---------------- */
const isMoney=(h:string)=>h.includes("(PHP)");
const show=(v:Cell,h:string)=>typeof v==="number"?(isMoney(h)?peso(v):h.includes("(%)")?`${v}%`:count(v)):v===null||v===undefined?"":String(v);
export function DataTable({data,range,search,label}:{data:Dataset;range?:DateRange;search?:boolean;label?:string}){
  const[sort,setSort]=useState<{col:number;dir:1|-1}|null>(null),[q,setQ]=useState("");
  const rows=useMemo(()=>{
    const t=q.trim().toLowerCase();
    let r=t?data.rows.filter(x=>x.some(c=>typeof c==="string"&&c.toLowerCase().includes(t))):data.rows;
    if(sort)r=[...r].sort((a,b)=>{const x=a[sort.col],y=b[sort.col];return(typeof x==="number"&&typeof y==="number"?x-y:String(x??"").localeCompare(String(y??""),undefined,{numeric:true}))*sort.dir});
    return r;
  },[data,q,sort]);
  const filtered=rows.length!==data.rows.length;
  const totals=useMemo(()=>data.totals?.map((c,i)=>typeof c==="number"&&filtered&&!data.headers[i]!.includes("(%)")?rows.reduce((n,x)=>n+(typeof x[i]==="number"?x[i] as number:0),0):c),[data,rows,filtered]);
  const exportCsv=()=>downloadCsv(range?csvName(data.id,range):`bulldogs-xchange-demo-${data.id}.csv`,toCsv(data.headers,totals?[...rows,totals]:rows));
  return <div className="data-table">
    <div className="dt-bar">{search?<label className="search"><span className="sr-only">Filter {data.title}</span><Icon name="search"/><input type="search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter rows"/></label>:<span/>}
      <span className="muted dt-count" aria-live="polite">{filtered?`${rows.length} of ${data.rows.length} rows`:`${data.rows.length} row${data.rows.length===1?"":"s"}`}</span>
      <button type="button" className="btn btn-secondary btn-sm no-print" onClick={exportCsv}><Icon name="download"/>Export CSV</button></div>
    <div className="table-wrap"><table><caption className="sr-only">{label??data.title}</caption>
      <thead><tr>{data.headers.map((h,i)=>{const num=data.rows.some(r=>typeof r[i]==="number");return <th key={h} className={num?"num":undefined} aria-sort={sort?.col===i?(sort.dir===1?"ascending":"descending"):"none"}><button type="button" className="th-sort" onClick={()=>setSort(sort?.col===i?(sort.dir===1?{col:i,dir:-1}:null):{col:i,dir:1})}>{h}<span aria-hidden="true">{sort?.col===i?(sort.dir===1?" ▲":" ▼"):""}</span></button></th>})}</tr></thead>
      <tbody>{rows.length?rows.map((r,ri)=><tr key={ri}>{r.map((c,i)=><td key={i} className={typeof c==="number"?"num":undefined}>{show(c,data.headers[i]!)}</td>)}</tr>):<tr><td colSpan={data.headers.length} className="muted">No rows match the current filter.</td></tr>}</tbody>
      {totals&&rows.length>0&&<tfoot><tr>{totals.map((c,i)=><td key={i} className={typeof c==="number"?"num":undefined}><strong>{show(c,data.headers[i]!)}</strong></td>)}</tr></tfoot>}</table></div>
  </div>;
}

/** Graph or table presentation for one visualization. */
export function ViewToggle({value,onChange,label}:{value:"chart"|"table";onChange(v:"chart"|"table"):void;label:string}){
  return <div className="view-toggle no-print" role="group" aria-label={`${label} view`}>{(["chart","table"] as const).map(v=><button key={v} type="button" aria-pressed={value===v} onClick={()=>onChange(v)}>{v==="chart"?"Graph":"Table"}</button>)}</div>;
}

/** Date filter for operational lists. The caller says which date it applies to (queue entry date, reservation date, or pickup date). */
export function DateFilter({value,onChange,now}:{value:DateFilterValue;onChange(v:DateFilterValue):void;now:string}){
  const r=filterRange(value,now)??resolveRange("today",now),opts:{id:DateFilterValue["preset"];label:string}[]=[{id:"all",label:"All dates"},{id:"today",label:"Today"},{id:"7d",label:"Last 7 days"},{id:"custom",label:"Custom"}];
  return <div className="date-filter"><div className="seg" role="group" aria-label="Date range">{opts.map(o=><button key={o.id} type="button" aria-pressed={value.preset===o.id} onClick={()=>onChange({preset:o.id,from:o.id==="custom"?r.from:value.from,to:o.id==="custom"?r.to:value.to})}>{o.label}</button>)}</div>
    {value.preset==="custom"&&<div className="date-inputs"><label>From<input type="date" value={value.from||r.from} max={value.to||r.to} onChange={e=>onChange({...value,from:e.target.value})}/></label><label>To<input type="date" value={value.to||r.to} min={value.from||r.from} onChange={e=>onChange({...value,to:e.target.value})}/></label></div>}</div>;
}
