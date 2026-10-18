import {useEffect,useRef,useState} from "react";
import {useNavigate} from "react-router-dom";
import {useSession} from "./session";

export function OAuthCallback(){const{completeGoogleSignIn}=useSession(),navigate=useNavigate(),[error,setError]=useState(""),started=useRef(false);useEffect(()=>{if(started.current)return;started.current=true;void completeGoogleSignIn().then(()=>navigate("/home",{replace:true})).catch(()=>setError("Google sign-in could not be completed.")).finally(()=>window.history.replaceState(null,"",window.location.pathname));},[completeGoogleSignIn,navigate]);return <main className="auth-callback" aria-live="polite">{error?<p role="alert">{error}</p>:<p>Completing secure sign-in…</p>}</main>}
