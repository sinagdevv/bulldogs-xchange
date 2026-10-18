import {useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {ApiError} from "./api";
import {useSession} from "./session";

export function OAuthCallback(){const{completeGoogleSignIn}=useSession(),navigate=useNavigate(),[error,setError]=useState(""),started=useRef(false);useEffect(()=>{if(started.current)return;started.current=true;void completeGoogleSignIn().then(()=>navigate("/home",{replace:true})).catch(reason=>setError(reason instanceof ApiError?reason.message:"Google sign-in could not be completed. Please return to sign in and try again.")).finally(()=>window.history.replaceState(null,"",window.location.pathname));},[completeGoogleSignIn,navigate]);return <main className="auth-callback" aria-live="polite">{error?<div role="alert"><p>{error}</p><button type="button" className="btn" onClick={()=>navigate("/",{replace:true})}>Return to sign in</button></div>:<p>Completing secure sign-in…</p>}</main>}
