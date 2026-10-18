import {useCallback,useEffect,useRef,useState} from "react";
import {NavLink} from "react-router-dom";
import {Icon} from "./icons";
import {usePointerParallax,useScrollParallax} from "./motion";
import "./showroom.css";

/* ---------- Merchandise shown in the showroom (existing assets only) ----------
 * approved: true  -> one of the three live public SKUs; links into the real catalog.
 * approved: false -> collection feature; never priced, never reservable.
 * opaque: true    -> the source photo has a light studio background, blended into the lit interior. */
export type Piece={id:string;name:string;line:string;src:string;approved:boolean;sku?:string;opaque?:boolean;note:string};
const P="/images/products/";
/* Keep the approved production art that composes the original showroom illustration. */
const showroomArt={
  "MRC-SHIRT":`${P}approved/MER-TSH-001-FRONT.webp`,
  "MRC-CAP":`${P}approved/MER-CAP-001-FRONT.webp`,
  "MRC-TOTE":`${P}approved/MER-TOTE-001-FRONT.webp`,
} as const;
const live=(sku:keyof typeof showroomArt)=>({sku,src:showroomArt[sku],approved:true});
const rack:Piece[]=[
  {id:"jacket",name:"Varsity Jacket",line:"Bulldogs outerwear",src:`${P}showcase/MER-JCKT-001-FRONT.webp`,approved:false,note:"Navy body with gold sleeves and the NU crest."},
  {id:"crew",name:"NATIONAL Crewneck",line:"PE and athletics",src:`${P}showcase/PE-SWT-001-FRONT.webp`,approved:false,note:"Heather crewneck with collegiate lettering."},
  {id:"shirt",name:"NU Bulldogs Shirt",line:"Official campus tee",...live("MRC-SHIRT"),note:"The everyday Bulldogs tee. Choose your size and reserve it in the shop."},
  {id:"uniform",name:"College Uniform Top",line:"Traditional college uniform",src:`${P}showcase/TRAD-TOP-001-FRONT-CUTOUT.webp`,approved:false,note:"Traditional college uniform reference."},
  {id:"pe",name:"PE Shirt",line:"PE and athletics",src:`${P}showcase/PE-TSH-001-FRONT.webp`,approved:false,note:"White PE shirt with the NU crest."},
  {id:"blazer",name:"Tourism Blazer",line:"Tourism Management",src:`${P}showcase/TM-BLAZ-001-FRONT.webp`,approved:false,note:"Tailored blazer for the Tourism Management program."},
  {id:"coat",name:"Tourism Coat",line:"Tourism Management",src:`${P}showcase/TM-COAT-001-FRONT.webp`,approved:false,note:"Single-breasted coat in charcoal gray."},
];
const shelves:{label:string;items:Piece[]}[]=[
  {label:"Headwear",items:[
    {id:"cap",name:"NU Bulldogs Cap",line:"Official cap",...live("MRC-CAP"),note:"The classic Bulldogs cap, made for game days and every day."},
    {id:"cap-w",name:"White Bulldog Cap",line:"Headwear",src:`${P}showcase/MER-CAP-002-FRONT-CUTOUT.webp`,approved:false,note:"Embroidered bulldog cap in white."},
    {id:"cap-b",name:"Black Bulldog Cap",line:"Headwear",src:`${P}showcase/MER-CAP-003-FRONT-CUTOUT.webp`,approved:false,note:"Embroidered bulldog cap in black."},
  ]},
  {label:"Drinkware",items:[
    {id:"cup-n",name:"Crest Tumbler",line:"Drinkware",src:`${P}showcase/MER-CUP-001-FRONT-CUTOUT.webp`,approved:false,note:"Navy tumbler with the NU crest."},
    {id:"cup-g",name:"Bulldog Tumbler",line:"Drinkware",src:`${P}showcase/MER-CUP-002-FRONT-CUTOUT.webp`,approved:false,note:"Gold tumbler with the bulldog mark."},
    {id:"fan-h",name:"Handheld Fan",line:"Accessories",src:`${P}showcase/MER-FAN-001-FRONT.webp`,approved:false,note:"Handheld fan in NU colors."},
  ]},
  {label:"Carry",items:[
    {id:"tote",name:"NU Bulldogs Tote",line:"Official tote",...live("MRC-TOTE"),note:"A roomy everyday tote carrying the Bulldogs mark."},
    {id:"tote-nu",name:"NU Monogram Tote",line:"Bags",src:`${P}showcase/MER-TOTE-002-FRONT-CUTOUT.webp`,approved:false,note:"Canvas tote with the NU monogram."},
  ]},
];

const reduced=()=>typeof window!=="undefined"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const vars=(o:Record<string,string|number>)=>o as React.CSSProperties;

function Status({approved}:{approved:boolean}){return approved?<span className="sr-chip live"><Icon name="check"/>Available to reserve</span>:<span className="sr-chip soft">Collection feature</span>}
/* The only per-item availability mark on a rack tag or cabinet label: a gold seal for the three live SKUs. */
function Seal(){return <><i className="sr-seal" aria-hidden="true"><Icon name="check"/></i><span className="sr-only"> Available to reserve</span></>}

export function FocusPanel({piece}:{piece:Piece}){
  return <aside className="sr-focus" aria-live="polite" aria-label="Selected item">
    <span className={`sr-focus-img${piece.opaque?" opaque":""}`}><img src={piece.src} alt="" width="320" height="320" decoding="async"/></span>
    <div className="sr-focus-body">
      <span className="sr-kicker">{piece.line}</span>
      <h3>{piece.name}</h3>
      <Status approved={piece.approved}/>
      <p>{piece.note}</p>
      {piece.approved&&<NavLink className="btn btn-gold" to="/catalog">View in shop<Icon name="arrow"/></NavLink>}
    </div>
  </aside>;
}

/* Horizontal scroller with prev/next, arrow keys and mouse drag. Touch uses native swipe with snap. */
function useScroller<T extends HTMLElement>(){
  const ref=useRef<T>(null),[edge,setEdge]=useState({start:true,end:false}),drag=useRef({on:false,x:0,left:0,moved:false});
  const update=useCallback(()=>{const el=ref.current;if(!el)return;const n={start:el.scrollLeft<=2,end:el.scrollLeft>=el.scrollWidth-el.clientWidth-2};setEdge(p=>p.start===n.start&&p.end===n.end?p:n)},[]);
  useEffect(()=>{const el=ref.current;update();el?.addEventListener("scroll",update,{passive:true});window.addEventListener("resize",update);return()=>{el?.removeEventListener("scroll",update);window.removeEventListener("resize",update)}},[update]);
  const go=(dir:1|-1)=>{const el=ref.current;if(el)el.scrollBy({left:dir*el.clientWidth*.6,behavior:reduced()?"auto":"smooth"})};
  const handlers={
    onPointerDown:(e:React.PointerEvent)=>{if(e.pointerType!=="mouse"||!ref.current)return;drag.current={on:true,x:e.clientX,left:ref.current.scrollLeft,moved:false}},
    onPointerMove:(e:React.PointerEvent)=>{const d=drag.current;if(!d.on||!ref.current)return;const dx=e.clientX-d.x;if(Math.abs(dx)>5){d.moved=true;ref.current.classList.add("dragging")}if(d.moved)ref.current.scrollLeft=d.left-dx},
    onPointerUp:()=>{drag.current.on=false;ref.current?.classList.remove("dragging")},
    onPointerLeave:()=>{drag.current.on=false;ref.current?.classList.remove("dragging")},
    onClickCapture:(e:React.MouseEvent)=>{if(drag.current.moved){e.preventDefault();e.stopPropagation();drag.current.moved=false}},
  };
  return {ref,edge,go,handlers};
}

function Arrows({edge,go,label}:{edge:{start:boolean;end:boolean};go:(d:1|-1)=>void;label:string}){
  return <div className="sr-arrows"><button type="button" className="sr-arrow prev" onClick={()=>go(-1)} disabled={edge.start} aria-label={`Previous ${label}`}><Icon name="arrow"/></button><button type="button" className="sr-arrow" onClick={()=>go(1)} disabled={edge.end} aria-label={`Next ${label}`}><Icon name="arrow"/></button></div>;
}

const moveFocus=(e:React.KeyboardEvent<HTMLElement>)=>{
  if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
  const all=Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-piece]")),i=all.indexOf(document.activeElement as HTMLElement);
  if(i<0)return;e.preventDefault();all[Math.max(0,Math.min(all.length-1,i+(e.key==="ArrowRight"?1:-1)))]?.focus();
};

/* ---------- Hero: an NU Fairview-inspired facade as the backdrop, with the storefront staged in front of it ---------- */
export function ShowroomHero(){
  const ref=usePointerParallax<HTMLElement>();useScrollParallax(ref);
  return <section className="sr-hero" ref={ref} aria-labelledby="hero-title">
    <div className="container sr-hero-in">
      <div className="sr-copy">
        <span className="sr-eyebrow">National University Fairview</span>
        <h1 id="hero-title">Show your <em>Bulldog</em> pride.</h1>
        <p className="sr-lede">Explore campus merchandise. Reserve what you love. Collect it at NU Fairview.</p>
        <div className="row sr-cta">
          <NavLink className="btn btn-gold btn-lg" to="/catalog">Explore merchandise<Icon name="arrow"/></NavLink>
          <NavLink className="btn btn-secondary btn-lg" to="/how-it-works">How it works</NavLink>
        </div>
        <ul className="sr-facts"><li><Icon name="store"/>Reserve online</li><li><Icon name="pin"/>Campus pickup only</li><li><Icon name="shield"/>Verified NU accounts</li></ul>
      </div>
      <figure className="sr-scene" aria-label="Illustration of the Bulldogs Xchange display, set before an NU Fairview-inspired facade">
        <div className="sr-tilt">
          <span className="sr-sky" aria-hidden="true"/>
          <div className="sr-bldg" aria-hidden="true">
            <span className="sr-louvers"/>
            <span className="sr-crest"><img src="/nu-crest.png" alt="" width="56" height="56"/></span>
            <span className="sr-canopy"/>
            <span className="sr-glass"/>
          </div>
          <div className="sr-stage">
            <span className="sr-beam b1" aria-hidden="true"/><span className="sr-beam b2" aria-hidden="true"/>
            <div className="sr-arch">
              <span className="sr-sign" aria-hidden="true"><span>BULLDOGS</span><b>XCHANGE</b></span>
              <span className="sr-interior" aria-hidden="true"/>
              <span className="sr-rod" aria-hidden="true"/>
              <span className="sr-hang"><Hanger/><img src={showroomArt["MRC-SHIRT"]} alt="NU Bulldogs Shirt" width="600" height="600" fetchPriority="high"/></span>
              <span className="sr-plinth p1"><img src={showroomArt["MRC-CAP"]} alt="NU Bulldogs Cap" width="600" height="600" decoding="async"/></span>
              <span className="sr-plinth p2"><img src={showroomArt["MRC-TOTE"]} alt="NU Bulldogs Tote" width="600" height="600" decoding="async"/></span>
            </div>
            <span className="sr-deck" aria-hidden="true"/>
          </div>
        </div>
        <figcaption>Illustration inspired by the NU Fairview campus.</figcaption>
      </figure>
    </div>
  </section>;
}

/* Hanger: hook, neck and sloped shoulders, so a garment visibly hangs from the arms instead of sitting under a bar. */
function Hanger(){return <svg className="sr-hanger" viewBox="0 0 140 46" aria-hidden="true" focusable="false"><path className="hk" d="M70 20V15c0-3 2.5-4.5 5-5 4-.8 6-3.6 6-6.6C81 1.800 79 0 76 0s-5 2-5 4.200"/><path className="arms" d="M70 20 11 38.500c-5 1.600-3.500 5.500 1.500 5.500h115c5 0 6.500-3.900 1.500-5.500L70 20Z"/></svg>}

/* ---------- The Apparel Rack ---------- */
export function ApparelRack(){
  const [sel,setSel]=useState("shirt"),{ref,edge,go,handlers}=useScroller<HTMLUListElement>();
  const piece=rack.find(p=>p.id===sel)!;
  /* Open the rack on the featured shirt without moving the page. */
  useEffect(()=>{const el=ref.current,on=el?.querySelector<HTMLElement>(".sr-garment.on");if(el&&on)el.scrollLeft=on.parentElement!.offsetLeft-(el.clientWidth-on.parentElement!.offsetWidth)/2},[ref]);
  return <section className="sr-sec sr-rack-sec" aria-labelledby="rack-title"><div className="container">
    <div className="sr-head" data-reveal><div><span className="eyebrow on-dark">The apparel rack</span><h2 id="rack-title" className="display sm on-dark">Browse the rack.</h2><p>Select a garment to bring it forward. A gold seal marks the pieces you can reserve in the shop.</p></div><Arrows edge={edge} go={go} label="garments"/></div>
    <div className="sr-rack-wrap" data-reveal>
      <div className="sr-rack">
        <div className="sr-rail-row">
        <span className="sr-bar" aria-hidden="true"/>
        <ul className="sr-garments" ref={ref} aria-label="Garments on the rack. Use the arrow keys, drag or swipe to browse." onKeyDown={moveFocus} {...handlers}>
          {rack.map((p,i)=><li key={p.id} style={vars({"--i":i})}>
            <button type="button" data-piece className={`sr-garment${sel===p.id?" on":""}`} aria-pressed={sel===p.id} onClick={()=>setSel(p.id)}>
              <Hanger/>
              <span className="sr-cloth" style={vars({"--img":`url(${p.src})`})}><img src={p.src} alt="" width="600" height="600" loading={i<3?"eager":"lazy"} decoding="async" draggable={false}/><i className="sr-select-badge" aria-hidden="true"><Icon name="check"/></i></span>
              <span className="sr-tag"><b>{p.name}</b>{p.approved&&<Seal/>}</span>
            </button>
          </li>)}
        </ul>
        <span className="sr-post l" aria-hidden="true"/><span className="sr-post r" aria-hidden="true"/>
        </div>
      </div>
      <FocusPanel piece={piece}/>
    </div>
  </div></section>;
}

/* ---------- The Accessories Cabinet ---------- */
export function AccessoriesCabinet(){
  const [sel,setSel]=useState("cap"),piece=shelves.flatMap(s=>s.items).find(p=>p.id===sel)!;
  return <section className="sr-sec sr-cab-sec" aria-labelledby="cab-title"><div className="container">
    <div className="sr-head" data-reveal><div><span className="eyebrow on-dark">The display cabinet</span><h2 id="cab-title" className="display sm on-dark">Accessories, on display.</h2><p>Caps, drinkware and carry pieces under warm cabinet light. Select an item to take a closer look.</p></div></div>
    <div className="sr-cab-wrap" data-reveal>
      <div className="sr-cab">
        <div className="sr-cab-sign" aria-hidden="true"><img src="/nu-crest.png" alt="" width="28" height="28"/><span>Bulldogs Xchange</span></div>
        <div className="sr-cab-glass">
        {shelves.map(s=><div className="sr-shelf" key={s.label} role="group" aria-label={s.label} onKeyDown={moveFocus}>
          <ul>{s.items.map((p,i)=><li key={p.id}>
            <button type="button" data-piece className={`sr-item${sel===p.id?" on":""}`} aria-pressed={sel===p.id} onClick={()=>setSel(p.id)}>
              <span className={`sr-obj${p.opaque?" opaque":""}`}><img src={p.src} alt="" width="600" height="600" loading={i<3?"eager":"lazy"} decoding="async"/><i className="sr-select-badge" aria-hidden="true"><Icon name="check"/></i></span>
              <span className="sr-label"><b>{p.name}</b>{p.approved&&<Seal/>}</span>
            </button>
          </li>)}</ul>
          <span className="sr-edge" aria-hidden="true"><span className="sr-plaque">{s.label}</span></span>
        </div>)}
        <span className="sr-glass-sheen" aria-hidden="true"/>
        </div>
        <span className="sr-cab-base" aria-hidden="true"/>
      </div>
      <FocusPanel piece={piece}/>
    </div>
  </div></section>;
}
