/**
 * Barky — Bulldogs Xchange AI shopping assistant.
 * Floating launcher + chat panel. Server-side AI only; keys never reach the browser.
 * Auth handled transparently by ApiClient (same as the rest of the app).
 */
import {useCallback,useEffect,useRef,useState} from "react";
import {useSession} from "./session";

// ---- Types -----------------------------------------------------------------
interface BarkyMsg {id:string;role:"user"|"assistant";content:string;ts:number}
type BarkyState="idle"|"open"

const SUGGESTED=[
  "What uniforms does Bulldogs Xchange carry?",
  "How do I pick up my reservation?",
  "What's available to reserve right now?",
  "How does the pickup queue work?",
];

// ---- Barky mascot SVG — yellow NU bulldog ----------------------------------
function BarkyMascot({size=48,animate=false,wave=false,think=false}:{size?:number;animate?:boolean;wave?:boolean;think?:boolean}){
  return(
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" className={`barky-mascot${animate?" barky-breathe":""}${wave?" barky-wave":""}`}>
      {/* Body — deep navy */}
      <ellipse cx="40" cy="59" rx="19" ry="14" fill="#0f2347"/>
      {/* Collar band — gold */}
      <rect x="25" y="52" width="30" height="8" rx="4" fill="#FFD700"/>
      {/* Collar stud */}
      <circle cx="40" cy="56" r="2.8" fill="#c8980a"/>
      {/* Head — bright gold with dark outline */}
      <ellipse cx="40" cy="35" rx="23" ry="22" fill="#FFD700" stroke="#b07800" strokeWidth="1.4"/>
      {/* Ears — darker gold */}
      <ellipse cx="18.5" cy="25" rx="6.5" ry="9.5" fill="#e6a800" stroke="#b07800" strokeWidth="1.2" transform="rotate(-18 18.5 25)"/>
      <ellipse cx="61.5" cy="25" rx="6.5" ry="9.5" fill="#e6a800" stroke="#b07800" strokeWidth="1.2" transform="rotate(18 61.5 25)"/>
      <ellipse cx="18.5" cy="25" rx="3.2" ry="5.8" fill="#c07000" transform="rotate(-18 18.5 25)"/>
      <ellipse cx="61.5" cy="25" rx="3.2" ry="5.8" fill="#c07000" transform="rotate(18 61.5 25)"/>
      {/* Eyes — large, expressive */}
      <ellipse cx="29.5" cy="32" rx="7.5" ry="8" fill="#111"/>
      <ellipse cx="50.5" cy="32" rx="7.5" ry="8" fill="#111"/>
      {/* Iris highlights */}
      <ellipse cx="32" cy="29.5" rx="3" ry="3" fill="white"/>
      <ellipse cx="53" cy="29.5" rx="3" ry="3" fill="white"/>
      <circle cx="31" cy="31" r="1.1" fill="white" opacity="0.55"/>
      <circle cx="52" cy="31" r="1.1" fill="white" opacity="0.55"/>
      {/* Muzzle — cream, distinct from gold */}
      <ellipse cx="40" cy="43.5" rx="10.5" ry="8.5" fill="#fffbe6" stroke="#c8a010" strokeWidth="0.9"/>
      {/* Nose */}
      <ellipse cx="40" cy="39.5" rx="5.5" ry="3.8" fill="#1a1010"/>
      <ellipse cx="38.5" cy="38.5" rx="1.6" ry="1" fill="#444" opacity="0.45"/>
      {/* Smile */}
      <path d="M33.5 46 Q40 50.5 46.5 46" stroke="#7a5000" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M40 48 L40 50.5" stroke="#7a5000" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Blush — warm amber tint */}
      <ellipse cx="21.5" cy="41" rx="4.5" ry="2.8" fill="#e87820" opacity="0.22"/>
      <ellipse cx="58.5" cy="41" rx="4.5" ry="2.8" fill="#e87820" opacity="0.22"/>
      {wave&&(
        <g className="barky-paw">
          <ellipse cx="63" cy="53" rx="7.5" ry="6.5" fill="#FFD700" stroke="#b07800" strokeWidth="1.1" transform="rotate(-30 63 53)"/>
          <ellipse cx="59.5" cy="49" rx="2.8" ry="2.2" fill="#e6a800" transform="rotate(-20 59.5 49)"/>
          <ellipse cx="63.5" cy="47.5" rx="2.8" ry="2.2" fill="#e6a800" transform="rotate(-8 63.5 47.5)"/>
          <ellipse cx="67.5" cy="49" rx="2.8" ry="2.2" fill="#e6a800" transform="rotate(12 67.5 49)"/>
        </g>
      )}
      {think&&(
        <g>
          <circle cx="52" cy="18" r="3.2" fill="#1a3a6e" className="barky-think-1"/>
          <circle cx="61" cy="12" r="4.2" fill="#1a3a6e" className="barky-think-2"/>
          <circle cx="71" cy="7" r="5.2" fill="#1a3a6e" className="barky-think-3"/>
        </g>
      )}
    </svg>
  );
}

// ---- Typing indicator ------------------------------------------------------
function TypingDots(){
  return <div className="barky-typing" aria-label="Barky is thinking…"><span/><span/><span/></div>;
}

// ---- Message bubble --------------------------------------------------------
function BarkyBubble({msg}:{msg:BarkyMsg}){
  const isUser=msg.role==="user";
  const time=new Date(msg.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  return(
    <div className={`barky-bubble ${isUser?"barky-user":"barky-assistant"}`}>
      {!isUser&&<div className="barky-avatar-sm" aria-hidden="true"><BarkyMascot size={30}/></div>}
      <div className="barky-bubble-body">
        <p>{msg.content}</p>
        <time dateTime={new Date(msg.ts).toISOString()} className="barky-ts">{time}</time>
      </div>
    </div>
  );
}

// ---- Connecting state ------------------------------------------------------
function BarkyConnecting(){
  return(
    <div className="barky-connecting">
      <div className="barky-connecting-mascot"><BarkyMascot size={56} animate/></div>
      <p className="barky-connecting-text">Connecting to Barky<span className="barky-dots"><span/><span/><span/></span></p>
      <p className="barky-connecting-sub">Your Bulldogs Xchange AI assistant</p>
    </div>
  );
}

// ---- Error card -------------------------------------------------------------
function BarkyErrorCard({message,onRetry,isConnectError}:{message:string;onRetry:()=>void;isConnectError:boolean}){
  return(
    <div className={`barky-error-card${isConnectError?" barky-error-connect":""}`} role="alert">
      <div className="barky-error-icon" aria-hidden="true">
        {isConnectError?(
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M10 6v4M10 13.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        ):(
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2L18 17H2L10 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
            <path d="M10 8v4M10 14.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        )}
      </div>
      <div className="barky-error-body">
        <strong>{isConnectError?"Can't reach Barky":"Something went wrong"}</strong>
        <span>{message}</span>
      </div>
      <button className="barky-retry-btn" onClick={onRetry}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 8C2 4.69 4.69 2 8 2a6 6 0 0 1 5.2 3H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M14 8c0 3.31-2.69 6-6 6a6 6 0 0 1-5.2-3H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Retry
      </button>
    </div>
  );
}

// ---- Main Barky widget -----------------------------------------------------
export function BarkyWidget(){
  const{api}=useSession();
  const[state,setState]=useState<BarkyState>("idle");
  const[msgs,setMsgs]=useState<BarkyMsg[]>([]);
  const[input,setInput]=useState("");
  const[sessionId,setSessionId]=useState<string|null>(null);
  const[connecting,setConnecting]=useState(false);
  const[error,setError]=useState("");
  const[connectError,setConnectError]=useState(false);
  const[sending,setSending]=useState(false);
  const msgEndRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,sending]);
  useEffect(()=>{if(state==="open"&&sessionId)setTimeout(()=>inputRef.current?.focus(),60)},[state,sessionId]);

  const startSession=useCallback(async()=>{
    setConnecting(true);setError("");setConnectError(false);
    try{
      const data=await api.request<{sessionId:string}>("barky/session",{method:"POST"});
      setSessionId(data.sessionId);
      setMsgs([{
        id:"welcome",role:"assistant",
        content:"Hey! I'm Barky, your Bulldogs Xchange assistant. Ask me about uniforms, merchandise, or how campus pickup works.",
        ts:Date.now(),
      }]);
    }catch(e){
      const msg=e instanceof Error?e.message:"Could not connect to Barky. Please try again.";
      setError(msg);setConnectError(true);
    }finally{setConnecting(false);}
  },[api]);

  const open=useCallback(()=>{
    setState("open");
    if(!sessionId&&!connecting)void startSession();
  },[sessionId,connecting,startSession]);

  const close=useCallback(()=>setState("idle"),[]);

  const send=useCallback(async(text?:string)=>{
    const msg=(text??input).trim();
    if(!msg||!sessionId||sending)return;
    setInput("");setError("");setConnectError(false);setSending(true);
    const userMsg:BarkyMsg={id:`u-${Date.now()}`,role:"user",content:msg,ts:Date.now()};
    setMsgs(m=>[...m,userMsg]);
    try{
      const data=await api.request<{reply:string}>("barky/chat",{
        method:"POST",body:JSON.stringify({sessionId,message:msg}),
      });
      setMsgs(m=>[...m,{id:`a-${Date.now()}`,role:"assistant",content:data.reply,ts:Date.now()}]);
    }catch(e){
      setError(e instanceof Error?e.message:"Barky had trouble responding.");
      setConnectError(false);
    }finally{setSending(false);}
  },[input,sessionId,sending,api]);

  const handleKey=(e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}
  };

  if(state==="idle"){
    return(
      <button
        className="barky-launcher"
        onClick={open}
        aria-label="Open Barky — Bulldogs Xchange assistant"
        title="Need a paw? Ask Barky."
      >
        <span className="barky-launcher-icon"><BarkyMascot size={46} animate/></span>
        <span className="barky-launcher-text">
          <span className="barky-launcher-label">Ask Barky</span>
          <span className="barky-launcher-sub">AI assistant</span>
        </span>
        <span className="barky-live-dot" aria-hidden="true"/>
      </button>
    );
  }

  return(
    <div className="barky-panel" role="dialog" aria-label="Barky — Bulldogs Xchange assistant" aria-modal="false">
      {/* Header */}
      <div className="barky-header">
        <div className="barky-header-mascot"><BarkyMascot size={44} wave/></div>
        <div className="barky-header-info">
          <strong className="barky-header-name">Barky</strong>
          <span className="barky-header-sub">Bulldogs Xchange AI</span>
        </div>
        <div className="barky-header-status">
          <span className={`barky-status-dot${connecting?" barky-status-connecting":""}`} aria-hidden="true"/>
          <span className="barky-status-label">{connecting?"Connecting":"Online"}</span>
        </div>
        <button className="barky-close" onClick={close} aria-label="Close Barky">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="barky-messages" aria-live="polite" aria-atomic="false">
        {connecting&&!sessionId&&<BarkyConnecting/>}
        {connectError&&error&&<BarkyErrorCard message={error} onRetry={()=>void startSession()} isConnectError={true}/>}
        {msgs.map(m=><BarkyBubble key={m.id} msg={m}/>)}
        {sending&&(
          <div className="barky-bubble barky-assistant">
            <div className="barky-avatar-sm" aria-hidden="true"><BarkyMascot size={30} think/></div>
            <div className="barky-bubble-body"><TypingDots/></div>
          </div>
        )}
        {!connectError&&error&&(
          <BarkyErrorCard message={error} onRetry={()=>void send()} isConnectError={false}/>
        )}
        <div ref={msgEndRef}/>
      </div>

      {/* Suggestions */}
      {msgs.length<=1&&!sending&&sessionId&&(
        <div className="barky-suggestions">
          {SUGGESTED.map(s=>(
            <button key={s} className="barky-suggest-btn" onClick={()=>void send(s)}>{s}</button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="barky-input-row">
        <input
          ref={inputRef}
          className="barky-input"
          value={input}
          onChange={e=>setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about merchandise or pickup…"
          maxLength={1000}
          disabled={!sessionId||sending}
          aria-label="Message Barky"
        />
        <button
          className="barky-send"
          disabled={!input.trim()||!sessionId||sending}
          onClick={()=>void send()}
          aria-label="Send message"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M2.5 10L17.5 3L10.5 17.5L8.5 11.5L2.5 10Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
