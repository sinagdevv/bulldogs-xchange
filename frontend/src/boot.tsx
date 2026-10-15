import {useEffect,useState} from "react";
import {CREST_ALT,CREST_SRC} from "./brand-assets";

/**
 * Branded initialization screen. It only appears when startup genuinely waits:
 * nothing renders for the first 150 ms (no flash on fast loads), and after 8 s it
 * offers a retry instead of spinning forever. The crest is the official asset, never redrawn.
 */
export function BrandLoader({onRetry}:{onRetry?:()=>void}){
  const[visible,setVisible]=useState(false),[slow,setSlow]=useState(false);
  useEffect(()=>{const a=window.setTimeout(()=>setVisible(true),150),b=window.setTimeout(()=>setSlow(true),8000);return()=>{window.clearTimeout(a);window.clearTimeout(b)}},[]);
  if(!visible)return <span className="sr-only" role="status">Loading Bulldogs Xchange</span>;
  return <div className="boot" role="status" aria-live="polite" aria-label="Loading Bulldogs Xchange">
    <div className="boot-inner">
      <span className="boot-crest">{CREST_SRC?<img src={CREST_SRC} alt={CREST_ALT} width="112" height="112" decoding="async"/>:null}</span>
      <p className="boot-word"><b>BULLDOGS</b><span>XCHANGE</span></p>
      <span className="boot-line" aria-hidden="true"><i/></span>
      {slow&&<div className="boot-slow"><p>This is taking longer than expected.</p>{onRetry&&<button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>Try again</button>}</div>}
    </div>
  </div>;
}
