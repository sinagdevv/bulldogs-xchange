import {createContext,useCallback,useContext,useMemo,useRef,useState,type ReactNode} from "react";
import {Icon} from "./icons";

type Tone="success"|"error"|"info";
type Toast={id:number;tone:Tone;title:string;message?:string};
type ToastApi={push(toast:Omit<Toast,"id">):void};
const ToastContext=createContext<ToastApi>({push:()=>{}});

export function ToastProvider({children}:{children:ReactNode}){
  const[items,setItems]=useState<Toast[]>([]),next=useRef(1);
  const dismiss=useCallback((id:number)=>setItems(list=>list.filter(t=>t.id!==id)),[]);
  const push=useCallback((toast:Omit<Toast,"id">)=>{const id=next.current++;setItems(list=>[...list.slice(-3),{...toast,id}]);window.setTimeout(()=>dismiss(id),toast.tone==="error"?8000:5000)},[dismiss]);
  const api=useMemo(()=>({push}),[push]);
  return <ToastContext.Provider value={api}>{children}<div className="toasts" aria-live="polite" aria-atomic="false">{items.map(t=><div key={t.id} className={`toast ${t.tone}`} role={t.tone==="error"?"alert":"status"}><Icon name={t.tone==="success"?"check":t.tone==="error"?"alert":"info"}/><div><strong>{t.title}</strong>{t.message&&<p>{t.message}</p>}</div><button type="button" onClick={()=>dismiss(t.id)} aria-label="Dismiss notification"><Icon name="x"/></button></div>)}</div></ToastContext.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const useToast=()=>useContext(ToastContext);
