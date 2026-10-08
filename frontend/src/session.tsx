import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {createAuthAdapter} from "./auth";
import {ApiClient} from "./api";
import type {Session} from "./types";

type SessionState={session:Session|null;loading:boolean;error:string|null;api:ApiClient};
const adapter=createAuthAdapter(),api=new ApiClient(adapter),Context=createContext<SessionState>({session:null,loading:true,error:null,api});
export function SessionProvider({children}:{children:ReactNode}){const[session,setSession]=useState<Session|null>(null),[error,setError]=useState<string|null>(null);useEffect(()=>{const controller=new AbortController();api.session(controller.signal).then(setSession).catch(e=>{if(e.name!=="AbortError")setError(e instanceof Error?e.message:"Session unavailable.");});return()=>controller.abort();},[]);const value=useMemo(()=>({session,loading:!session&&!error,error,api}),[session,error]);return <Context.Provider value={value}>{children}</Context.Provider>}
// eslint-disable-next-line react-refresh/only-export-components
export const useSession=()=>useContext(Context);
