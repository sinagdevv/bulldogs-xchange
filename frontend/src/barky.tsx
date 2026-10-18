/**
 * Barky — Bulldogs Xchange AI shopping assistant.
 * Floating launcher + chat panel. Server-side AI only; keys never reach the browser.
 * Auth handled transparently by ApiClient (same as the rest of the app).
 */
import {useCallback,useEffect,useRef,useState} from "react";
import {useLocation} from "react-router-dom";
import {useSession} from "./session";

// ---- Types -----------------------------------------------------------------
interface BarkyMsg {id:string;role:"user"|"assistant";content:string;ts:number;degraded?:boolean}
type BarkyState="idle"|"open"

const SUGGESTED=[
  {label:"Uniforms & gear",full:"What uniforms does Bulldogs Xchange carry?"},
  {label:"Pickup steps",full:"How do I pick up my reservation?"},
  {label:"What's available",full:"What's available to reserve right now?"},
  {label:"Queue info",full:"How does the pickup queue work?"},
];

// ---- Barky mascot SVG — muscular gold NU bulldog, rubber-hose 1930s-cartoon outline ----
// Five genuinely distinct states, each driving its own CSS keyframe animation (see styles.css):
//   idle        — breathing + periodic blink
//   happy       — greeting wave, head bob, paw raised
//   thinking    — narrowed eyes, bobbing thought bubbles
//   responding  — quick talk-bounce + mouth flap, one-shot on mount
//   error       — drooped ears, worried brow, a cartoon sweat drop
export type BarkyMascotState="idle"|"happy"|"thinking"|"responding"|"error";

export function BarkyMascot({size=48,state="idle"}:{size?:number;state?:BarkyMascotState}){
  const wave=state==="happy",think=state==="thinking",sad=state==="error";
  const browL=sad?"M20 27 Q27 31 34 27.5":"M21 24.5 Q27.5 20 34 23.5";
  const browR=sad?"M46 27.5 Q53 31 60 27":"M46 23.5 Q52.5 20 59 24.5";
  return(
    <svg width={size} height={size} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true" className={`barky-mascot barky-mascot-${state}`}>
      {/* Body — broad, muscular shoulders (wider + squatter than a plain dog icon), bold outline */}
      <ellipse cx="40" cy="60" rx="21" ry="15" fill="#0f2347" stroke="#0a0a0a" strokeWidth="2"/>
      <ellipse cx="25" cy="58" rx="7.5" ry="9" fill="#0f2347" stroke="#0a0a0a" strokeWidth="2"/>
      <ellipse cx="55" cy="58" rx="7.5" ry="9" fill="#0f2347" stroke="#0a0a0a" strokeWidth="2"/>
      {/* Collar band — gold, with spiked studs for school-mascot energy */}
      <rect x="24" y="52" width="32" height="8" rx="4" fill="#FFD700" stroke="#0a0a0a" strokeWidth="1.6"/>
      <circle cx="30.5" cy="56" r="1.6" fill="#0a0a0a"/>
      <circle cx="40" cy="56" r="1.6" fill="#0a0a0a"/>
      <circle cx="49.5" cy="56" r="1.6" fill="#0a0a0a"/>
      {/* Collar tag */}
      <circle cx="40" cy="63" r="3" fill="#fffbe6" stroke="#0a0a0a" strokeWidth="1.4"/>
      {/* Head — bright gold with bold black outline */}
      <ellipse cx="40" cy="35" rx="23" ry="22" fill="#FFD700" stroke="#0a0a0a" strokeWidth="2.2"/>
      {/* Ears — darker gold, bold outline; droop on error */}
      <g className="barky-ear-l"><ellipse cx="18.5" cy="25" rx="6.5" ry="9.5" fill="#e6a800" stroke="#0a0a0a" strokeWidth="1.8" transform="rotate(-18 18.5 25)"/><ellipse cx="18.5" cy="25" rx="3.2" ry="5.8" fill="#c07000" transform="rotate(-18 18.5 25)"/></g>
      <g className="barky-ear-r"><ellipse cx="61.5" cy="25" rx="6.5" ry="9.5" fill="#e6a800" stroke="#0a0a0a" strokeWidth="1.8" transform="rotate(18 61.5 25)"/><ellipse cx="61.5" cy="25" rx="3.2" ry="5.8" fill="#c07000" transform="rotate(18 61.5 25)"/></g>
      {/* Brow — friendly-aggressive furrow by default, worried arch on error */}
      <path className="barky-brow" d={browL} stroke="#0a0a0a" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path className="barky-brow" d={browR} stroke="#0a0a0a" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Eyes — large, expressive, bold-outlined; blink on idle, narrow on think, squint on error */}
      <g className="barky-eye barky-eye-l"><ellipse cx="29.5" cy="32" rx="7.5" ry="8" fill="#111" stroke="#0a0a0a" strokeWidth="1.2"/><ellipse cx="32" cy="29.5" rx="3" ry="3" fill="white"/><circle cx="31" cy="31" r="1.1" fill="white" opacity="0.55"/></g>
      <g className="barky-eye barky-eye-r"><ellipse cx="50.5" cy="32" rx="7.5" ry="8" fill="#111" stroke="#0a0a0a" strokeWidth="1.2"/><ellipse cx="53" cy="29.5" rx="3" ry="3" fill="white"/><circle cx="52" cy="31" r="1.1" fill="white" opacity="0.55"/></g>
      {/* Muzzle — cream, distinct from gold, bold outline */}
      <ellipse cx="40" cy="43.5" rx="10.5" ry="8.5" fill="#fffbe6" stroke="#0a0a0a" strokeWidth="1.6"/>
      {/* Nose */}
      <ellipse cx="40" cy="39.5" rx="5.5" ry="3.8" fill="#1a1010" stroke="#0a0a0a" strokeWidth="0.8"/>
      <ellipse cx="38.5" cy="38.5" rx="1.6" ry="1" fill="#444" opacity="0.45"/>
      {/* Mouth — open grin with teeth by default; small worried "oh" on error */}
      {sad?(
        <path className="barky-mouth" d="M34.5 48 Q40 45 45.5 48" stroke="#0a0a0a" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      ):(
        <g className="barky-mouth">
          <path d="M32 45.5 Q40 52.5 48 45.5 Q40 49.5 32 45.5 Z" fill="#fff" stroke="#0a0a0a" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M40 48.2 L40 50.5" stroke="#0a0a0a" strokeWidth="1.6" strokeLinecap="round"/>
        </g>
      )}
      {/* Blush — warm amber tint */}
      <ellipse cx="21.5" cy="41" rx="4.5" ry="2.8" fill="#e87820" opacity="0.28"/>
      <ellipse cx="58.5" cy="41" rx="4.5" ry="2.8" fill="#e87820" opacity="0.28"/>
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
      {sad&&(
        <path className="barky-sweat" d="M58 18 Q61 23 58 26 Q55 23 58 18 Z" fill="#8ecbff" stroke="#0a0a0a" strokeWidth="1"/>
      )}
    </svg>
  );
}

// ---- Typing indicator ------------------------------------------------------
function TypingDots(){
  return <div className="barky-typing" aria-label="Barky is thinking…"><span/><span/><span/></div>;
}

// ---- Message bubble --------------------------------------------------------
// A "degraded" reply (both AI providers were unreachable) is real conversation history, not an
// exception -- it stays in the message list in order, but renders as a clearly-marked notice card
// instead of a plain reply, with a retry action on only the most recent one.
export function BarkyBubble({msg,onRetry}:{msg:BarkyMsg;onRetry?:()=>void}){
  const isUser=msg.role==="user";
  const time=new Date(msg.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  if(msg.degraded){
    return(
      <div className="barky-bubble barky-assistant" role="status">
        <div className="barky-avatar-sm" aria-hidden="true"><BarkyMascot size={30} state="error"/></div>
        <div className="barky-bubble-body">
          <div className="barky-degraded-card">
            <strong>Running without AI right now</strong>
            <p>{msg.content}</p>
            {onRetry&&<button className="barky-retry-btn barky-retry-inline" onClick={onRetry}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 8C2 4.69 4.69 2 8 2a6 6 0 0 1 5.2 3H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 8c0 3.31-2.69 6-6 6a6 6 0 0 1-5.2-3H5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Try again
            </button>}
          </div>
          <time dateTime={new Date(msg.ts).toISOString()} className="barky-ts">{time}</time>
        </div>
      </div>
    );
  }
  return(
    <div className={`barky-bubble ${isUser?"barky-user":"barky-assistant"}`}>
      {!isUser&&<div className="barky-avatar-sm" aria-hidden="true"><BarkyMascot size={30} state="responding"/></div>}
      <div className="barky-bubble-body">
        <p>{msg.content}</p>
        <time dateTime={new Date(msg.ts).toISOString()} className="barky-ts">{time}</time>
      </div>
    </div>
  );
}

// ---- Empty-state hero --------------------------------------------------------
// Shown instead of the plain welcome bubble on first open, before anything has been asked --
// a bigger, centered mascot moment rather than a one-line chat message.
export function BarkyHero(){
  return(
    <div className="barky-hero">
      <div className="barky-hero-glow" aria-hidden="true"/>
      <div className="barky-hero-mascot"><BarkyMascot size={64} state="idle"/></div>
      <strong className="barky-hero-title">Hey, I&apos;m Barky!</strong>
      <p className="barky-hero-sub">Ask about uniforms, merchandise, or how campus pickup works.</p>
    </div>
  );
}

// ---- Connecting state ------------------------------------------------------
function BarkyConnecting(){
  return(
    <div className="barky-connecting">
      <div className="barky-connecting-mascot"><BarkyMascot size={56} state="thinking"/></div>
      <p className="barky-connecting-text">Connecting to Barky<span className="barky-dots"><span/><span/><span/></span></p>
      <p className="barky-connecting-sub">Your Bulldogs Xchange AI assistant</p>
    </div>
  );
}

// ---- Error card -------------------------------------------------------------
function BarkyErrorCard({message,onRetry,isConnectError}:{message:string;onRetry:()=>void;isConnectError:boolean}){
  return(
    <div className={`barky-error-card${isConnectError?" barky-error-connect":""}`} role="alert">
      <div className="barky-avatar-sm barky-avatar-error" aria-hidden="true"><BarkyMascot size={30} state="error"/></div>
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
// Public routes that intentionally show Barky even though they are not behind auth --
// a visitor shopping or reading how pickup works is exactly who the suggested prompts target.
const HIDDEN_ON=new Set(["/"]);
export function BarkyWidget(){
  const{api}=useSession();
  const{pathname}=useLocation();
  const[state,setState]=useState<BarkyState>("idle");
  const[msgs,setMsgs]=useState<BarkyMsg[]>([]);
  const[input,setInput]=useState("");
  const[sessionId,setSessionId]=useState<string|null>(null);
  const[connecting,setConnecting]=useState(false);
  const[error,setError]=useState("");
  const[connectError,setConnectError]=useState(false);
  const[aiUnavailable,setAiUnavailable]=useState(false);
  const[sending,setSending]=useState(false);
  const lastUserTextRef=useRef("");
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
    lastUserTextRef.current=msg;
    setMsgs(m=>[...m,userMsg]);
    try{
      const data=await api.request<{reply:string;aiAvailable:boolean}>("barky/chat",{
        method:"POST",body:JSON.stringify({sessionId,message:msg}),
      });
      setAiUnavailable(!data.aiAvailable);
      setMsgs(m=>[...m,{id:`a-${Date.now()}`,role:"assistant",content:data.reply,ts:Date.now(),degraded:!data.aiAvailable}]);
    }catch(e){
      setAiUnavailable(true);
      setError(e instanceof Error?e.message:"Barky had trouble responding.");
      setConnectError(false);
    }finally{setSending(false);}
  },[input,sessionId,sending,api]);

  const handleKey=(e:React.KeyboardEvent<HTMLInputElement>)=>{
    if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();void send();}
  };

  const isEmptyState=msgs.length===1&&msgs[0]!.id==="welcome"&&!sending;

  // Hooks above must run on every render regardless of route, so the landing-page opt-out is a plain
  // return after them, not an early return before -- keeps hook order stable per React's rules.
  if(HIDDEN_ON.has(pathname))return null;

  if(state==="idle"){
    return(
      <button
        className="barky-launcher"
        onClick={open}
        aria-label="Open Barky — Bulldogs Xchange assistant"
        title="Need a paw? Ask Barky."
      >
        <span className="barky-launcher-icon"><BarkyMascot size={46} state="idle"/></span>
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
        <div className="barky-header-mascot"><BarkyMascot size={44} state="happy"/></div>
        <div className="barky-header-info">
          <strong className="barky-header-name">Barky</strong>
          <span className="barky-header-sub">Bulldogs Xchange AI</span>
        </div>
        <div className="barky-header-status">
          <span className={`barky-status-dot${connecting?" barky-status-connecting":aiUnavailable?" barky-status-unavailable":""}`} aria-hidden="true"/>
          <span className="barky-status-label">{connecting?"Connecting":aiUnavailable?"AI Unavailable":"Online"}</span>
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
        {isEmptyState?<BarkyHero/>:msgs.map((m,i)=>(
          <BarkyBubble key={m.id} msg={m} onRetry={m.degraded&&i===msgs.length-1&&!sending?()=>void send(lastUserTextRef.current):undefined}/>
        ))}
        {sending&&(
          <div className="barky-bubble barky-assistant">
            <div className="barky-avatar-sm" aria-hidden="true"><BarkyMascot size={30} state="thinking"/></div>
            <div className="barky-bubble-body"><TypingDots/></div>
          </div>
        )}
        {!connectError&&error&&(
          <BarkyErrorCard message={error} onRetry={()=>void send(lastUserTextRef.current)} isConnectError={false}/>
        )}
        <div ref={msgEndRef}/>
      </div>

      {/* Suggestions */}
      {msgs.length<=1&&!sending&&sessionId&&(
        <div className="barky-suggestions">
          {SUGGESTED.map(s=>(
            <button key={s.label} className="barky-suggest-btn" onClick={()=>void send(s.full)}>
              <strong>{s.label}</strong>
              <span>{s.full}</span>
            </button>
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
