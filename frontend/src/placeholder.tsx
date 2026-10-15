import {useState} from "react";

import {kindLabel,placeholderKind,type PlaceholderKind} from "./placeholder-data";

export type PlaceholderProps={
  /** Category or product name used to choose the silhouette. */
  category?:string;
  kind?:PlaceholderKind;
  aspect?:"4/5"|"1/1"|"4/3"|"16/10";
  size?:"sm"|"md"|"lg";
  tone?:"blue"|"deep"|"light";
  label?:string;
  /** Visible helper text, hidden on small sizes. */
  caption?:string|false;
};

/**
 * Reusable merchandise image placeholder. Pure presentation: swap it for an <img>
 * by passing a real image URL to ProductImage and nothing else changes.
 */
export function ProductImagePlaceholder({category,kind,aspect="1/1",size="md",tone="blue",label,caption="Image coming soon"}:PlaceholderProps){
  const k=kind??placeholderKind(category);
  return <div className={`pip pip-${size} pip-${tone}`} style={{aspectRatio:aspect.replace("/"," / ")}} role="img" aria-label={label??`${kindLabel[k]} placeholder (image coming soon)`}>
    <span className="pip-grid" aria-hidden="true"/>
    <svg className="pip-shape pip-bulldog" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><path className="pip-body" d="M50 15c-17 0-30 8-33 22-5-1-9-6-9-14 0-6 3-11 7-13 5 3 10 5 14 6 6-5 13-7 21-7s15 2 21 7c4-1 9-3 14-6 4 2 7 7 7 13 0 8-4 13-9 14C80 23 67 15 50 15Zm-33 22c-2 14 0 26 7 36 5 8 14 12 26 12s21-4 26-12c7-10 9-22 7-36-4 8-12 13-33 13S21 45 17 37Z"/><path className="pip-detail" d="M36 62c4 4 9 6 14 6s10-2 14-6M44 52c0-3 3-5 6-5s6 2 6 5M32 41l7 2M68 41l-7 2"/></svg>
    {caption!==false&&<small className="pip-cap" aria-hidden="true">{caption}</small>}
  </div>;
}

/** Real catalog image when one is recorded, labelled placeholder otherwise or on load failure. */
export function ImageOrPlaceholder({src,alt,category,eager,aspect,size,tone}:{src?:string;alt:string;category?:string;eager?:boolean}&Pick<PlaceholderProps,"aspect"|"size"|"tone">){
  const[failed,setFailed]=useState(false),url=src?.trim();
  if(!url||failed)return <ProductImagePlaceholder category={category??alt} label={`${alt} (image coming soon)`} aspect={aspect} size={size} tone={tone}/>;
  return <img src={url} alt={alt} loading={eager?"eager":"lazy"} decoding="async" onError={()=>setFailed(true)}/>;
}
