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

// ---- Barky mascot SVG (original bulldog character) -------------------------
function BarkyMascot({size=48,animate=false,wave=false,think=false}:{size?:number;animate?:boolean;wave?:boolean;think?:boolean}){
  return(
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" className={`barky-mascot${animate?" barky-breathe":""}${wave?" barky-wave":""}`}>
      <ellipse cx="40" cy="58" rx="18" ry="14" fill="#1a3a6e"/>
      <rect x="26" y="52" width="28" height="7" rx="3.5" fill="#FFD700"/>
      <circle cx="40" cy="55.5" r="2.5" fill="#e6b800"/>
      <ellipse cx="40" cy="36" rx="22" ry="21" fill="#f5f0e8"/>
      <ellipse cx="19" cy="26" rx="6" ry="9" fill="#d4cfc6" transform="rotate(-15 19 26)"/>
      <ellipse cx="61" cy="26" rx="6" ry="9" fill="#d4cfc6" transform="rotate(15 61 26)"/>
      <ellipse cx="19.5" cy="26.5" rx="3" ry="5.5" fill="#c4bdb4" transform="rotate(-15 19.5 26.5)"/>
      <ellipse cx="60.5" cy="26.5" rx="3" ry="5.5" fill="#c4bdb4" transform="rotate(15 60.5 26.5)"/>
      <ellipse cx="29" cy="33" rx="7" ry="7.5" fill="#111"/>
      <ellipse cx="51" cy="33" rx="7" ry="7.5" fill="#111"/>
      <ellipse cx="31.5" cy="30.5" rx="2.5" ry="2.5" fill="white"/>
      <ellipse cx="53.5" cy="30.5" rx="2.5" ry="2.5" fill="white"/>
      <circle cx="30" cy="32" r="1" fill="white" opacity="0.5"/>
      <circle cx="52" cy="32" r="1" fill="white" opacity="0.5"/>
      <ellipse cx="40" cy="43" rx="10" ry="8" fill="#e8e0d0"/>
      <ellipse cx="40" cy="39.5" rx="5" ry="3.5" fill="#3a3030"/>
      <ellipse cx="39" cy="38.5" rx="1.5" ry="1" fill="#555" opacity="0.5"/>
      <path d="M34 45 Q40 49 46 45" stroke="#b89a8a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M40 47 L40 49" stroke="#b89a8a" strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="23" cy="40" rx="4" ry="2.5" fill="#e8a0a0" opacity="0.35"/>
      <ellipse cx="57" cy="40" rx="4" ry="2.5" fill="#e8a0a0" opacity="0.35"/>
      {wave&&(
        <g className="barky-paw">
          <ellipse cx="63" cy="54" rx="7" ry="6" fill="#f5f0e8" transform="rotate(-30 63 54)"/>
          <ellipse cx="60" cy="50" rx="2.5" ry="2" fill="#e8e0d0" transform="rotate(-20 60 50)"/>
          <ellipse cx="64" cy="48.5" rx="2.5" ry="2" fill="#e8e0d0" transform="rotate(-10 64 48.5)"/>
          <ellipse cx="67.5" cy="50" rx="2.5" ry="2" fill="#e8e0d0" transform="rotate(10 67.5 50)"/>
        </g>
      )}
      {think&&(
        <g>
          <circle cx="52" cy="18" r="3" fill="#1a3a6e" className="barky-think-1"/>
          <circle cx="60" cy="13" r="4" fill="#1a3a6e" className="barky-think-2"/>
          <circle cx="70" cy="8" r="5" fill="#1a3a6e" className="barky-think-3"/>
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
      {!isUser&&<div className="barky-avatar-sm" aria-hidden="true"><BarkyMascot size={28}/></div>}
      <div className="barky-bubble-body">
        <p>{msg.content}</p>
        <time dateTime={new Date(msg.ts).toISOString()} className="barky-ts">{time}</time>
      </div>
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
  const[error,setError]=useState("");
  const[sending,setSending]=useState(false);
  const msgEndRef=useRef<HTMLDivElement>(null);
  const inputRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{msgEndRef.current?.scrollIntoView({behavior:"smooth"})},[msgs,sending]);
  useEffect(()=>{if(state==="open")setTimeout(()=>inputRef.current?.focus(),50)},[state]);

  const open=useCallback(async()=>{
    setState("open");
    if(sessionId)return;
    try{
      const data=await api.request<{sessionId:string}>("barky/session",{method:"POST"});
      setSessionId(data.sessionId);
      setMsgs([{
        id:"welcome",role:"assistant",
        content:"Hi! I'm Barky, your Bulldogs Xchange assistant. Ask me about uniforms, merchandise, or campus pickup!",
        ts:Date.now(),
      }]);
    }catch{
      setError("Could not connect to Barky. Please try again.");
    }
  },[sessionId,api]);

  const close=useCallback(()=>setState("idle"),[]);

  const send=useCallback(async(text?:string)=>{
    const msg=(text??input).trim();
    if(!msg||!sessionId||sending)return;
    setInput("");setError("");setSending(true);
    const userMsg:BarkyMsg={id:`u-${Date.now()}`,role:"user",content:msg,ts:Date.now()};
    setMsgs(m=>[...m,userMsg]);
    try{
      const data=await api.request<{reply:string}>("barky/chat",{
        method:"POST",body:JSON.stringify({sessionId,message:msg}),
      });
      setMsgs(m=>[...m,{id:`a-${Date.now()}`,role:"assistant",content:data.reply,ts:Date.now()}]);
    }catch(e){
      setError(e instanceof Error?e.message:"Barky had trouble responding.");
    }finally{setSending(false);}
  },[input,sessionId,sending,api]);

  const handleKey=(e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}
  };

  if(state==="idle"){
    return(
      <button
        className="barky-launcher"
        onClick={()=>void open()}
        aria-label="Open Barky — Bulldogs Xchange assistant"
        title="Need a paw? Ask Barky."
      >
        <BarkyMascot size={38} animate/>
        <span className="barky-launcher-label">Ask Barky</span>
      </button>
    );
  }

  return(
    <div className="barky-panel" role="dialog" aria-label="Barky — Bulldogs Xchange assistant" aria-modal="false">
      <div className="barky-header">
        <div className="barky-header-left">
          <BarkyMascot size={34} wave/>
          <div>
            <strong>Barky</strong>
            <span className="barky-tagline">Need a paw? Ask Barky.</span>
          </div>
        </div>
        <button className="barky-close" onClick={close} aria-label="Close Barky">×</button>
      </div>

      <div className="barky-messages" aria-live="polite" aria-atomic="false">
        {msgs.map(m=><BarkyBubble key={m.id} msg={m}/>)}
        {sending&&(
          <div className="barky-bubble barky-assistant">
            <div className="barky-avatar-sm" aria-hidden="true"><BarkyMascot size={28} think/></div>
            <div className="barky-bubble-body"><TypingDots/></div>
          </div>
        )}
        {error&&(
          <div className="barky-error" role="alert">
            <span>{error}</span>
            <button className="barky-retry" onClick={()=>void send()}>Retry</button>
          </div>
        )}
        <div ref={msgEndRef}/>
      </div>

      {msgs.length<=1&&!sending&&(
        <div className="barky-suggestions">
          {SUGGESTED.map(s=>(
            <button key={s} className="barky-suggest-btn" onClick={()=>void send(s)}>{s}</button>
          ))}
        </div>
      )}

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
            <path d="M3 10L17 3L10 17L8.5 11.5L3 10Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
