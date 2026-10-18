import {useState} from "react";

import {kindLabel,placeholderKind,shapes,type PlaceholderKind} from "./placeholder-data";

export type PlaceholderProps={
  /** Category or product name used to choose the silhouette. */
  category?:string;
  kind?:PlaceholderKind;
  aspect?:"4/5"|"1/1"|"4/3"|"16/10";
  size?:"sm"|"md"|"lg";
  tone?:"blue"|"deep"|"light";
  label?:string;
  /** Visible helper text. Pass false to suppress. Defaults to hidden (no caption). */
  caption?:string|false;
};

/**
 * Reusable merchandise image placeholder. Pure presentation: swap it for an <img>
 * by passing a real image URL to ProductImage and nothing else changes.
 * Uses category-appropriate clothing silhouettes instead of a branded character.
 */
export function ProductImagePlaceholder({category,kind,aspect="1/1",size="md",tone="blue",label,caption=false}:PlaceholderProps){
  const k=kind??placeholderKind(category);
  const shape=shapes[k];
  return <div className={`pip pip-${size} pip-${tone}`} style={{aspectRatio:aspect.replace("/"," / ")}} role="img" aria-label={label??`${kindLabel[k]} (photo not yet available)`}>
    <span className="pip-grid" aria-hidden="true"/>
    <svg className="pip-shape" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path className="pip-body" d={shape.body}/>
      <path className="pip-detail" d={shape.detail}/>
    </svg>
    {caption!==false&&<small className="pip-cap" aria-hidden="true">{caption}</small>}
  </div>;
}

/** Real catalog image when one is recorded, labelled placeholder otherwise or on load failure. */
export function ImageOrPlaceholder({src,alt,category,eager,aspect,size,tone}:{src?:string;alt:string;category?:string;eager?:boolean}&Pick<PlaceholderProps,"aspect"|"size"|"tone">){
  const[failed,setFailed]=useState(false),url=src?.trim();
  if(!url||failed)return <ProductImagePlaceholder category={category??alt} label={`${alt} (photo not yet available)`} aspect={aspect} size={size} tone={tone}/>;
  return <img src={url} alt={alt} loading={eager?"eager":"lazy"} decoding="async" onError={()=>setFailed(true)}/>;
}
