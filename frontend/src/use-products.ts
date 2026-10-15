import {useEffect,useState} from "react";
import {useSession} from "./session";
import type {Product} from "./types";
import {errorMessage,isAbort} from "./format";

/** Loads the public catalog from the existing API. Exposes retry for error states. */
export function useProducts(){
  const{api}=useSession(),[products,setProducts]=useState<Product[]|null>(null),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  useEffect(()=>{const c=new AbortController();api.products(c.signal).then(setProducts).catch(e=>{if(!isAbort(e))setError(errorMessage(e))});return()=>c.abort()},[api,attempt]);
  return{products,error,retry:()=>{setError("");setProducts(null);setAttempt(a=>a+1)}};
}
