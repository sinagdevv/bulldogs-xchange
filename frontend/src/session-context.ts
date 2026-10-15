import {createContext} from "react";
import type {ApiClient} from "./api";
import type {Session} from "./types";

export type SessionState={session:Session|null;loading:boolean;error:string|null;authOpen:boolean;authMode?:"login"|"register";/** Increments after each successful login, so the router can redirect once. */loginCount?:number;api:ApiClient;login(email:string,password:string):Promise<void>;register(input:{email:string;studentId:string;fullName:string;password:string;confirmPassword:string}):Promise<void>;requestPasswordReset(email:string):Promise<void>;openAuth(mode?:"login"|"register"):void;closeAuth():void;logout():Promise<void>;reload():Promise<void>};
const noop=async()=>{};
export const SessionContext=createContext<SessionState>({session:null,loading:true,error:null,authOpen:false,api:null as unknown as ApiClient,login:noop,register:noop,requestPasswordReset:noop,openAuth:()=>{},closeAuth:()=>{},logout:noop,reload:noop});
