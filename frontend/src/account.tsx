import {useState,type FormEvent} from "react";
import {Navigate} from "react-router-dom";
import {useSession} from "./session";
import {Modal} from "./components";
import {Brand} from "./brand";
import {Icon} from "./icons";

export function Onboarding(){return <Navigate to="/" replace/>}

function PasswordField({name,label,hint,autoComplete,minLength,onChange,invalid,describedBy}:{name:string;label:string;hint?:string;autoComplete:string;minLength:number;onChange?(value:string):void;invalid?:boolean;describedBy?:string}){const[show,setShow]=useState(false);return <label className="field"><span>{label}</span><span className="input-group"><input name={name} type={show?"text":"password"} required minLength={minLength} maxLength={128} autoComplete={autoComplete} aria-invalid={invalid||undefined} aria-describedby={describedBy} onChange={e=>onChange?.(e.target.value)}/><button type="button" className="reveal" onClick={()=>setShow(v=>!v)} aria-pressed={show} aria-label={show?`Hide ${label.toLowerCase()}`:`Show ${label.toLowerCase()}`}>{show?"Hide":"Show"}</button></span>{hint&&<small>{hint}</small>}</label>}

export function AuthPanel(){const{authOpen,authMode}=useSession();return authOpen?<AuthDialog key={authMode??"login"} initialMode={authMode??"login"}/>:null}
function AuthDialog({initialMode}:{initialMode:"login"|"register"}){
  const{closeAuth,login}=useSession(),[mode,setMode]=useState<"login"|"register"|"recover">(initialMode),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setError("");const data=new FormData(e.currentTarget);setBusy(true);try{await login(String(data.get("identity")).trim(),String(data.get("password")))}catch(e){setError(e instanceof Error?e.message:"Authentication failed.")}finally{setBusy(false)}};
  const loginMode=mode==="login";
  return <Modal bare title={loginMode?"Sign in to Bulldogs Xchange":mode==="register"?"Account provisioning":"Password reset"} labelledBy="auth-title" onClose={closeAuth} className="auth">
    <aside className="auth-aside"><div className="auth-aside-top"><Brand tone="dark" size={84}/></div><div className="auth-message"><h3>Exclusively for National University Fairview students and authorized personnel.</h3><ol><li>Use the Student ID assigned to your provisioned account.</li><li>Await Admin approval before accessing account features.</li><li>Contact the Bulldogs Xchange office for account help.</li></ol></div></aside>
    <div className="auth-main auth-wrap"><button type="button" className="icon-btn close-btn" onClick={closeAuth} aria-label="Close dialog"><Icon name="x"/></button>
      <span className="eyebrow">{loginMode?"Student portal":mode==="register"?"Operator provisioning":"Operator-assisted recovery"}</span>
      <h2 id="auth-title">{loginMode?"Sign in to Bulldogs Xchange":mode==="register"?"Accounts are provisioned privately":"Password reset is operator-assisted"}</h2>
      {loginMode?<><p className="sub">Use your Student ID and password. Existing institutional-email accounts may continue using their email.</p><form onSubmit={e=>void submit(e)}><label className="field"><span>Student ID</span><input name="identity" required minLength={3} maxLength={320} autoComplete="username" data-autofocus spellCheck={false}/><small>Existing institutional-email users may enter their NU Fairview email.</small></label><PasswordField name="password" label="Password" minLength={1} autoComplete="current-password"/>{error&&<p className="field-error" role="alert"><Icon name="alert"/>{error}</p>}<button className="btn btn-lg btn-block" disabled={busy}>{busy?<><span className="spinner sm" aria-hidden="true"/>Please wait</>:"Log in"}</button></form><p className="auth-forgot"><button type="button" className="text-link" onClick={()=>setMode("recover")}>Forgot password?</button></p><p className="auth-switch">Need an account? <button type="button" className="text-link" onClick={()=>setMode("register")}>Provisioning information</button></p></>:<><div className="notice auth-notice"><Icon name="info"/><p>{mode==="register"?"Public signup is disabled. Present your school ID to an authorized Bulldogs Xchange operator to request a pending Customer account.":"Student ID aliases cannot receive email. Visit the Bulldogs Xchange office with your school ID for an audited operator-assisted reset. Existing institutional-email accounts may use their email recovery path."}</p></div><p className="auth-switch"><button type="button" className="text-link" onClick={()=>setMode("login")}>Back to login</button></p></>}
    </div>
  </Modal>;
}
