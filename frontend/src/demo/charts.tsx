import {useEffect,useRef,useState,type ReactNode} from "react";

/** Measures the container so SVG text stays at a true pixel size instead of scaling with a viewBox. */
function useWidth(initial=560){
  const ref=useRef<HTMLDivElement>(null),[w,setW]=useState(initial);
  useEffect(()=>{const el=ref.current;if(!el||typeof ResizeObserver==="undefined")return;const ro=new ResizeObserver(e=>{const next=Math.round(e[0]!.contentRect.width);if(next>0)setW(next)});ro.observe(el);return()=>ro.disconnect()},[]);
  return{ref,w};
}
const niceMax=(v:number)=>{if(v<=4)return 4;const step=Math.pow(10,Math.floor(Math.log10(v/4))),m=[1,2,2.5,5,10].find(x=>x*step*4>=v)!;return m*step*4};

export function ChartFrame({title,note,children,table}:{title:string;note?:string;children:ReactNode;table?:ReactNode}){
  return <figure className="chart-frame"><figcaption><strong>{title}</strong>{note&&<span>{note}</span>}</figcaption>{children}{table&&<details className="chart-table"><summary>View as table</summary>{table}</details>}</figure>;
}

export interface Point{label:string;value:number}
/** Single-series line with area. Hover or focus a point for its value. */
export function LineChart({data,label,height=210,unit="reservations"}:{data:Point[];label:string;height?:number;unit?:string}){
  const{ref,w}=useWidth(),pad={l:30,r:14,t:24,b:26},H=height,max=niceMax(Math.max(1,...data.map(d=>d.value))),n=data.length;
  const x=(i:number)=>pad.l+(n<2?0:i*(w-pad.l-pad.r)/(n-1)),y=(v:number)=>pad.t+(1-v/max)*(H-pad.t-pad.b);
  const line=data.map((d,i)=>`${i?"L":"M"}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join(""),area=`${line}L${x(n-1).toFixed(1)} ${H-pad.b}L${x(0).toFixed(1)} ${H-pad.b}Z`;
  const ticks=[0,1,2,3,4].map(k=>k*max/4),every=Math.ceil(n/(w<420?5:8)),last=data[n-1];
  return <div ref={ref} className="chart"><svg width={w} height={H} role="img" aria-label={label}>
    {ticks.map(t=><g key={t}><line className="grid" x1={pad.l} x2={w-pad.r} y1={y(t)} y2={y(t)}/><text className="tick" x={pad.l-6} y={y(t)+4} textAnchor="end">{t}</text></g>)}
    <path className="area" d={area}/><path className="line" d={line} pathLength={1}/>
    {data.map((d,i)=>(i%every===0&&n-1-i>=Math.ceil(every/2))||i===n-1?<text key={d.label} className="tick" x={x(i)} y={H-8} textAnchor={i===0?"start":i===n-1?"end":"middle"}>{d.label}</text>:null)}
    {data.map((d,i)=><g key={d.label} className="pt" tabIndex={0}><rect x={x(i)-Math.max(8,(w-pad.l-pad.r)/n/2)} y={pad.t} width={Math.max(16,(w-pad.l-pad.r)/n)} height={H-pad.t-pad.b} fill="transparent"/><circle cx={x(i)} cy={y(d.value)} r={4.5}/><title>{`${d.label}: ${d.value} ${unit}`}</title></g>)}
    {last&&<text className="end-label" x={x(n-1)} y={y(last.value)-10} textAnchor="end">{last.value}</text>}
  </svg></div>;
}

/** Vertical columns, one series, rounded data ends and a 2px gap between bars. */
export function Columns({data,label,height=210,unit="pickups"}:{data:Point[];label:string;height?:number;unit?:string}){
  const{ref,w}=useWidth(),pad={l:30,r:8,t:14,b:26},H=height,max=niceMax(Math.max(1,...data.map(d=>d.value))),n=data.length,slot=(w-pad.l-pad.r)/n,bw=Math.max(6,Math.min(26,slot-4));
  const y=(v:number)=>pad.t+(1-v/max)*(H-pad.t-pad.b),every=Math.ceil(n/(w<420?5:8));
  return <div ref={ref} className="chart"><svg width={w} height={H} role="img" aria-label={label}>
    {[0,1,2,3,4].map(k=>{const t=k*max/4;return <g key={k}><line className="grid" x1={pad.l} x2={w-pad.r} y1={y(t)} y2={y(t)}/><text className="tick" x={pad.l-6} y={y(t)+4} textAnchor="end">{t}</text></g>})}
    {data.map((d,i)=>{const cx=pad.l+slot*i+slot/2,top=y(d.value);return <g key={d.label} className="col" tabIndex={0}><rect className="bar" x={cx-bw/2} y={top} width={bw} height={Math.max(0,H-pad.b-top)} rx={3} style={{transformOrigin:`${cx}px ${H-pad.b}px`,animationDelay:`${i*25}ms`}}/><rect x={cx-slot/2} y={pad.t} width={slot} height={H-pad.t-pad.b} fill="transparent"/>{i%every===0&&<text className="tick" x={cx} y={H-8} textAnchor="middle">{d.label}</text>}<title>{`${d.label}: ${d.value} ${unit}`}</title></g>})}
  </svg></div>;
}

/** Ranked horizontal bars with the value always printed. */
export function BarList({items,unit}:{items:{label:string;value:number}[];unit:string}){
  const max=Math.max(1,...items.map(i=>i.value));
  return <div className="bars bar-list" role="list">{items.map((it,i)=><div className="bar-row" role="listitem" key={it.label} title={`${it.label}: ${it.value} ${unit}`}><span className="bl-label">{it.label}</span><span className="track"><span className="fill" style={{width:`${it.value/max*100}%`,animationDelay:`${i*50}ms`}}/></span><span className="v">{it.value}</span></div>)}</div>;
}

/** Part-to-whole bar with a labelled legend (labels and counts, never color alone). */
export function StackedBar({items,label}:{items:{label:string;value:number;color:string}[];label:string}){
  const total=items.reduce((s,i)=>s+i.value,0)||1;
  return <div className="stacked"><div className="stack-bar" role="img" aria-label={label}>{items.filter(i=>i.value>0).map(i=><span key={i.label} style={{flexGrow:i.value,background:i.color}} title={`${i.label}: ${i.value}`}/>)}</div>
    <ul className="legend">{items.map(i=><li key={i.label}><i style={{background:i.color}}/><span>{i.label}</span><b>{i.value}</b><small>{Math.round(i.value/total*100)}%</small></li>)}</ul></div>;
}
