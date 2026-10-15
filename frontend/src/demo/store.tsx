import {useCallback,useMemo,useRef,useState,type ReactNode} from "react";
import {applyAction} from "./engine";
import {createSeedState} from "./seed";
import {DemoContext,type DemoApi} from "./store-context";
import type {Action,DemoState} from "./types";

/* The only persistence is sessionStorage for the current tab, so a page refresh during a presentation keeps the demo state.
   It is never sent anywhere. Reset Demo clears it. */
const KEY="bx-demo-state-v3";
function load():DemoState{
  try{const raw=sessionStorage.getItem(KEY);if(raw){const p=JSON.parse(raw) as DemoState;if(p?.version===3&&Array.isArray(p.reservations)&&Array.isArray(p.variants)&&!!p.settings)return p}}catch{/* storage unavailable */}
  return createSeedState();
}
function save(s:DemoState|null){try{if(s)sessionStorage.setItem(KEY,JSON.stringify(s));else sessionStorage.removeItem(KEY)}catch{/* storage unavailable */}}

export function DemoProvider({children}:{children:ReactNode}){
  const[state,setState]=useState<DemoState>(load),ref=useRef(state);
  const dispatch=useCallback((action:Action)=>{
    const r=applyAction(ref.current,action);
    if(r.ok){ref.current=r.state;setState(r.state);save(action.type==="reset"?null:r.state)}
    return r;
  },[]);
  const reset=useCallback(()=>dispatch({type:"reset"}),[dispatch]);
  const value=useMemo<DemoApi>(()=>({state,dispatch,reset}),[state,dispatch,reset]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}
