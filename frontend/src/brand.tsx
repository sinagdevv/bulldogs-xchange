import type {CSSProperties} from "react";
import {CREST_ALT,CREST_SRC} from "./brand-assets";

/* ---------------------------------------------------------------
   Bulldogs Xchange identity: the official NU crest paired with a
   typographic wordmark. The crest is the only emblem. It is shown
   from the supplied asset and is never redrawn, recolored, or stretched.
   --------------------------------------------------------------- */
export type LogoTone="light"|"dark"|"mono";

/**
 * Wordmark. BULLDOGS is the dominant word. XCHANGE sits beneath it, tracked out so its letters span
 * exactly the width of BULLDOGS, with a gold X. Font size is set by the parent (em based).
 */
export function Wordmark({tone="light"}:{tone?:LogoTone}){
  return <span className={`wordmark wm-${tone}`} role="img" aria-label="Bulldogs Xchange">
    <b className="wm-top" aria-hidden="true">Bulldogs</b>
    <span className="wm-bot" aria-hidden="true">{"XCHANGE".split("").map((c,i)=><i key={i} className={i===0?"x":undefined}>{c}</i>)}</span>
  </span>;
}

/**
 * Shared brand lockup: official crest, a hairline divider, and the wordmark.
 * `size` is the crest height in px; the wordmark scales from it. `compact` shows the crest only (collapsed sidebar).
 */
export function Brand({light,tone,size=40,compact,caption}:{light?:boolean;tone?:LogoTone;size?:number;compact?:boolean;caption?:string}){
  const t:LogoTone=tone??(light?"dark":"light"),style={"--s":`${size}px`} as CSSProperties;
  return <span className={`brand brand-${t}${compact?" compact":""}`} style={style}>
    <Crest height={size}/>
    {compact?<span className="sr-only">Bulldogs Xchange</span>:<><span className="brand-rule" aria-hidden="true"/><span className="brand-text"><Wordmark tone={t}/>{caption&&<small>{caption}</small>}</span></>}
  </span>;
}

/** Official crest slot. Renders the supplied asset, or a labelled placeholder if the asset is ever unset. */
export function Crest({size="md",tone="light",showLabel,height}:{size?:"sm"|"md"|"lg";tone?:"light"|"dark";showLabel?:boolean;height?:number}){
  const style=height?{height:`${height}px`,width:"auto"}:undefined;
  if(CREST_SRC)return <img className={`crest crest-${size}`} style={style} src={CREST_SRC} alt={CREST_ALT} draggable={false}/>;
  return <span className={`crest crest-ph crest-${size} crest-${tone}`} role="img" aria-label="National University Fairview crest" title="National University Fairview"><span className="crest-ring" aria-hidden="true"><b>NU</b></span>{(showLabel||size==="lg")&&<small aria-hidden="true">NU CREST PLACEHOLDER</small>}</span>;
}
