import {useCallback,useMemo} from "react";
import {useSearchParams} from "react-router-dom";
import {useToast} from "../toast";
import {useDemo} from "./store-context";
import {rangeFromParams,rangeToParams,type DateRange} from "./reports";
import type {Action,Result} from "./types";

/** Dispatches a demo action and shows the success or error toast. Returns the engine result. */
export function useRun(){
  const{dispatch}=useDemo(),toast=useToast();
  return useCallback((action:Action,opts?:{quiet?:boolean}):Result=>{
    const r=dispatch(action);
    if(!opts?.quiet)toast.push({tone:r.ok?"success":"error",title:r.ok?r.message:"Action not allowed",...(r.ok?{}:{message:r.message})});
    return r;
  },[dispatch,toast]);
}

/** The selected reporting range lives in the URL (?range=7d or ?range=custom&from=&to=) so it is shared by charts, tables, exports and reports. */
export function useRange(){
  const{state}=useDemo(),[params,setParams]=useSearchParams();
  const range=useMemo(()=>rangeFromParams(params,state.now),[params,state.now]);
  const setRange=useCallback((r:DateRange)=>setParams(rangeToParams(r),{replace:true}),[setParams]);
  return{range,setRange,params};
}
