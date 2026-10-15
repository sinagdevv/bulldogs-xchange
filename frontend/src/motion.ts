import {useEffect,useRef} from "react";

const reduced=()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Adds .in to every [data-reveal] element when it scrolls into view. Content stays visible without JS or with reduced motion. */
export function useReveal(){
  useEffect(()=>{
    const nodes=Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if(!nodes.length)return;
    if(reduced()||!("IntersectionObserver" in window)){nodes.forEach(n=>n.classList.add("in"));return}
    document.documentElement.classList.add("reveal-ready");
    const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target)}}),{rootMargin:"0px 0px -8% 0px",threshold:.12});
    nodes.forEach(n=>io.observe(n));
    return()=>{io.disconnect();document.documentElement.classList.remove("reveal-ready")};
  },[]);
}

/** Writes --px/--py (-1..1) on the element from pointer position. Fine pointers only, never with reduced motion. */
export function usePointerParallax<T extends HTMLElement>(){
  const ref=useRef<T>(null);
  useEffect(()=>{
    const el=ref.current;
    if(!el||reduced()||!window.matchMedia("(hover: hover) and (pointer: fine)").matches)return;
    let raf=0;
    const move=(e:PointerEvent)=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const r=el.getBoundingClientRect();el.style.setProperty("--px",String(((e.clientX-r.left)/r.width-.5)*2));el.style.setProperty("--py",String(((e.clientY-r.top)/r.height-.5)*2))})};
    const leave=()=>{el.style.setProperty("--px","0");el.style.setProperty("--py","0")};
    el.addEventListener("pointermove",move);el.addEventListener("pointerleave",leave);
    return()=>{cancelAnimationFrame(raf);el.removeEventListener("pointermove",move);el.removeEventListener("pointerleave",leave)};
  },[]);
  return ref;
}

/** Writes --sy (scroll offset in px, only while the hero is on screen) for layered parallax. Disabled with reduced motion. */
export function useScrollParallax(ref:React.RefObject<HTMLElement|null>){
  useEffect(()=>{
    const el=ref.current;
    if(!el||reduced())return;
    let raf=0;
    const update=()=>{raf=0;const y=Math.min(window.scrollY,el.offsetHeight*1.2);el.style.setProperty("--sy",String(y))};
    const onScroll=()=>{if(!raf)raf=requestAnimationFrame(update)};
    window.addEventListener("scroll",onScroll,{passive:true});update();
    return()=>{window.removeEventListener("scroll",onScroll);if(raf)cancelAnimationFrame(raf)};
  },[ref]);
}

/** Gentle scroll depth: writes --dy on every [data-depth] element near the viewport. Use with the CSS `translate` property. Disabled with reduced motion. */
export function useDepth(){
  useEffect(()=>{
    if(reduced())return;
    const els=Array.from(document.querySelectorAll<HTMLElement>("[data-depth]"));
    if(!els.length)return;
    let raf=0;
    const update=()=>{raf=0;const vh=window.innerHeight;els.forEach(el=>{const r=el.getBoundingClientRect();if(r.bottom<-120||r.top>vh+120)return;el.style.setProperty("--dy",`${((r.top+r.height/2-vh/2)*(Number(el.dataset.depth)||0)).toFixed(1)}px`)})};
    const on=()=>{if(!raf)raf=requestAnimationFrame(update)};
    window.addEventListener("scroll",on,{passive:true});window.addEventListener("resize",on);update();
    return()=>{window.removeEventListener("scroll",on);window.removeEventListener("resize",on);if(raf)cancelAnimationFrame(raf)};
  },[]);
}
