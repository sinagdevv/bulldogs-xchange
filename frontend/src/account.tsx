import {useState,type FormEvent} from "react";
import {Navigate} from "react-router-dom";
import {useSession} from "./session";
import {Modal} from "./components";
import {Brand} from "./brand";
import {Icon} from "./icons";

export function Onboarding(){return <Navigate to="/" replace/>}

const strength=(value:string)=>{if(!value)return 0;let score=value.length>=10?1:0;if(/[A-Za-z]/.test(value)&&/\d/.test(value))score++;if(value.length>=14||/[^A-Za-z0-9]/.test(value))score++;return Math.max(1,score)};

function PasswordField({name,label,hint,autoComplete,minLength,onChange,invalid,describedBy}:{name:string;label:string;hint?:string;autoComplete:string;minLength:number;onChange?(value:string):void;invalid?:boolean;describedBy?:string}){const[show,setShow]=useState(false);return <label className="field"><span>{label}</span><span className="input-group"><input name={name} type={show?"text":"password"} required minLength={minLength} maxLength={128} autoComplete={autoComplete} aria-invalid={invalid||undefined} aria-describedby={describedBy} onChange={e=>onChange?.(e.target.value)}/><button type="button" className="reveal" onClick={()=>setShow(v=>!v)} aria-pressed={show} aria-label={show?`Hide ${label.toLowerCase()}`:`Show ${label.toLowerCase()}`}>{show?"Hide":"Show"}</button></span>{hint&&<small>{hint}</small>}</label>}

const rules:[string,(v:string)=>boolean][]=[["At least 10 characters",v=>v.length>=10],["Letters and numbers",v=>/[A-Za-z]/.test(v)&&/\d/.test(v)],["A symbol or 14+ characters (stronger)",v=>v.length>=14||/[^A-Za-z0-9]/.test(v)]];

/** Account-enumeration-safe copy: matches the backend's generic response exactly, whether or not the address is registered. */
const recoverySentMessage="If the account exists, password recovery instructions will be sent.";

export function AuthPanel(){const{authOpen,authMode}=useSession();return authOpen?<AuthDialog key={authMode??"login"} initialMode={authMode??"login"}/>:null}
function AuthDialog({initialMode}:{initialMode:"login"|"register"}){
  const{closeAuth,login,register,requestPasswordReset}=useSession(),[mode,setMode]=useState<"login"|"register"|"recover">(initialMode),[busy,setBusy]=useState(false),[error,setError]=useState(""),[password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
  const[recoverSent,setRecoverSent]=useState(false);
  const registering=mode==="register",recovering=mode==="recover",score=strength(password),mismatch=registering&&confirm.length>0&&confirm!==password;
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setError("");const data=new FormData(e.currentTarget);if(recovering){setBusy(true);try{await requestPasswordReset(String(data.get("email")).trim());setRecoverSent(true)}catch(e){setError(e instanceof Error?e.message:"Could not send recovery instructions. Try again shortly.")}finally{setBusy(false)}return}if(registering&&data.get("password")!==data.get("confirmPassword")){setError("Passwords do not match.");return}setBusy(true);try{if(!registering)await login(String(data.get("email")).trim(),String(data.get("password")));else await register({email:String(data.get("email")).trim(),studentId:String(data.get("studentId")).trim(),fullName:String(data.get("fullName")).trim(),password:String(data.get("password")),confirmPassword:String(data.get("confirmPassword"))});}catch(e){setError(e instanceof Error?e.message:"Authentication failed.")}finally{setBusy(false)}};
  const switchMode=(next:"login"|"register"|"recover")=>{setError("");setPassword("");setConfirm("");setRecoverSent(false);setMode(next)};
  return <Modal bare title={registering?"Create student account":recovering?"Reset your password":"Sign in to Bulldogs Xchange"} labelledBy="auth-title" onClose={closeAuth} className="auth">
    <aside className="auth-aside"><div className="auth-aside-top"><Brand tone="dark" size={84}/></div>
      <div className="auth-message"><h3>Exclusively for National University Fairview students and authorized personnel.</h3>
        <ol>{registering?<><li>Register with your NU email and Student ID.</li><li>Verify your institutional inbox.</li><li>Await Admin approval.</li></>:recovering?<><li>Enter your verified NU institutional email.</li><li>Open the recovery link we send to that inbox.</li><li>Choose a new password and sign in again.</li></>:<><li>Log in with your verified NU email and password.</li><li>Reserve available merchandise.</li><li>Track your order and collect it at campus pickup.</li></>}</ol></div>
      </aside>
    <div className="auth-main auth-wrap"><button type="button" className="icon-btn close-btn" onClick={closeAuth} aria-label="Close dialog"><Icon name="x"/></button>
      <span className="eyebrow">{registering?"New student account":recovering?"Account recovery":"Student portal"}</span>
      <h2 id="auth-title">{registering?"Create student account":recovering?"Reset your password":"Sign in to Bulldogs Xchange"}</h2><p className="sub">{registering?"Verify your institutional inbox, then wait for Admin approval before reserving merchandise.":recovering?"We'll email recovery instructions if the address matches a verified account.":"Use your verified NU Fairview institutional email and password."}</p>
      {recovering&&recoverSent?<><p role="status">{recoverySentMessage}</p><p className="auth-switch"><button type="button" className="text-link" onClick={()=>switchMode("login")}>Back to login</button></p></>:
      <form onSubmit={e=>void submit(e)} noValidate={false}>
        <label className="field"><span>NU Fairview email</span><input name="email" required type="email" maxLength={320} autoComplete="username" placeholder="name@students.nu-fairview.edu.ph" data-autofocus spellCheck={false} aria-describedby="email-help"/><small id="email-help">Use your @students.nu-fairview.edu.ph or @nu-fairview.edu.ph account.</small></label>
        {registering&&<><label className="field"><span>Student ID</span><input name="studentId" required minLength={3} maxLength={50} inputMode="text" spellCheck={false} aria-describedby="sid-help" placeholder="e.g. 2024-123456"/><small id="sid-help">Enter the ID printed on your NU Fairview school ID. An Admin independently verifies your identity.</small></label><label className="field"><span>Full name</span><input name="fullName" required minLength={2} maxLength={200} autoComplete="name" placeholder="As shown on your school ID"/></label></>}
        {!recovering&&<PasswordField name="password" label="Password" minLength={registering?10:1} autoComplete={registering?"new-password":"current-password"} describedBy={registering?"pw-rules":undefined} onChange={setPassword}/>}
        {registering&&<><div className={`strength s${password?score:0}`} aria-hidden="true"><i/><i/><i/></div><ul className="pw-rules" id="pw-rules" aria-label="Password requirements">{rules.map(([text,ok])=><li key={text} className={password&&ok(password)?"met":""}><Icon name={password&&ok(password)?"check":"minus"}/>{text}</li>)}</ul></>}
        {registering&&<><PasswordField name="confirmPassword" label="Confirm password" minLength={10} autoComplete="new-password" invalid={mismatch} describedBy={mismatch?"pw-mismatch":undefined} onChange={setConfirm}/>{mismatch&&<p className="field-hint-error" id="pw-mismatch" role="status">Passwords do not match yet.</p>}</>}
        {registering&&<div className="notice auth-notice"><Icon name="info"/><p><strong>Eligibility.</strong> Open to NU Fairview students and authorized personnel only. An Admin manually reviews each registration, so you cannot reserve until approved.</p></div>}
        {mode==="login"&&<p className="auth-forgot"><button type="button" className="text-link" onClick={()=>switchMode("recover")}>Forgot password?</button></p>}
        {error&&<p className="field-error" role="alert"><Icon name="alert"/>{error}</p>}
        <button className="btn btn-lg btn-block" disabled={busy}>{busy?<><span className="spinner sm" aria-hidden="true"/>Please wait</>:registering?"Submit registration":recovering?"Send recovery email":"Log in"}</button>
      </form>}
      {!recovering&&<p className="auth-switch">{registering?"Already registered? ":"New to Bulldogs Xchange? "}<button type="button" className="text-link" onClick={()=>switchMode(registering?"login":"register")}>{registering?"Back to login":"Register"}</button></p>}
      {recovering&&!recoverSent&&<p className="auth-switch"><button type="button" className="text-link" onClick={()=>switchMode("login")}>Back to login</button></p>}
    </div>
  </Modal>;
}
