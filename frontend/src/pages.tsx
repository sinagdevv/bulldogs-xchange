import {useEffect,useMemo,useState} from "react";
import {useProducts} from "./use-products";
import {NavLink,useLocation} from "react-router-dom";
import {Empty,ErrorState,PageHeader,ProductCard} from "./components";
import {useSession} from "./session";
import type {Category} from "./types";
import {Icon} from "./icons";
import {showcaseItems} from "./showcase";

export {Landing} from "./landing";
import {faq,journey,phases,stepResults} from "./content";
import {isStaticPreview} from "./deployment-mode";
import {useReveal} from "./motion";

type CatalogCollectionItem={file:string;src:string;title:string;category:string;type:string;studio:boolean};
function CatalogCollectionCard({item}:{item:CatalogCollectionItem}){return<article className="lp-card2 collection-only"><div className="lp-photo"><img src={item.src} alt={item.title} loading="lazy"/></div><div className="lp-meta"><span><b>{item.title}</b><small>{item.type} · {item.category}</small></span><span className="coll-only-pill">Collection</span></div></article>}

export function Catalog(){const{api}=useSession(),{products,error,retry}=useProducts(),[categories,setCategories]=useState<Category[]>([]),[category,setCategory]=useState(""),[search,setSearch]=useState("");useEffect(()=>{const c=new AbortController();api.categories(c.signal).then(setCategories).catch(()=>{/* filters stay hidden when categories are unavailable */});return()=>c.abort()},[api]);const visible=useMemo(()=>(products??[]).filter(p=>(!category||p.categoryId===category)&&(!search||`${p.title} ${p.sku} ${p.description}`.toLowerCase().includes(search.toLowerCase()))),[products,category,search]);const active=categories.filter(c=>c.isActive);
  const collectionItems=useMemo(()=>{if(!search)return showcaseItems;const q=search.toLowerCase();return showcaseItems.filter(i=>i.title.toLowerCase().includes(q)||i.type.toLowerCase().includes(q)||i.category.toLowerCase().includes(q))},[search]);
  const collectionGroups=useMemo(()=>{const map=new Map<string,typeof showcaseItems>();for(const item of collectionItems){const g=map.get(item.category)??[];g.push(item);map.set(item.category,g)}return[...map.entries()]},[collectionItems]);
  const showCollection=!category&&collectionGroups.length>0;
  return <section className="container page"><PageHeader eyebrow="Bulldogs collection" title="Campus merchandise" description="Browse the live catalog. Log in with an approved student account to choose sizes and reserve for campus pickup."/>
    <div className="toolbar"><label className="search"><span className="sr-only">Search merchandise</span><Icon name="search"/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search merchandise or uniforms"/></label></div>
    {active.length>0&&<div className="chips toolbar-chips" role="group" aria-label="Filter by category"><button type="button" className="chip" aria-pressed={!category} onClick={()=>setCategory("")}>All</button>{active.map(c=><button type="button" key={c.id} className="chip" aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>{c.title}</button>)}</div>}
    {showCollection&&<section className="collection-section" aria-label="Campus collection">
      <div className="section-head"><div><h2>Campus collection</h2><p>Program uniforms and official merchandise available at Bulldogs Xchange.</p></div></div>
      {collectionGroups.map(([cat,items])=><div key={cat} className="collection-category"><h3 className="collection-cat-title">{cat}</h3><div className="collection-grid">{items.map(item=><CatalogCollectionCard key={item.file} item={item}/>)}</div></div>)}
    </section>}
  </section>}

export function InfoPage(){const{openAuth,session}=useSession(),{hash}=useLocation();useReveal();
  useEffect(()=>{if(!hash)return;const el=document.getElementById(hash.slice(1));if(el)requestAnimationFrame(()=>el.scrollIntoView({block:"start"}))},[hash]);
  return <div className="hiw">
    <header className="hiw-hero"><div className="container"><span className="eyebrow on-dark">How it works</span><h1>From discovery to pickup.</h1><p>One account, one reservation, one trip to the campus counter. Here is the whole journey.</p>
      <ul className="hiw-phases" aria-label="Journey phases">{phases.map((ph,i)=><li key={ph.id}><a href={`#${ph.id}`}><span className="pn">{i+1}</span>{ph.name}</a></li>)}</ul>
    </div></header>
    <div className="container hiw-journey">
      {phases.map((ph,pi)=><section className="hiw-phase" id={ph.id} key={ph.id} aria-labelledby={`${ph.id}-title`} data-reveal>
        <div className="hiw-phase-head"><span className="hiw-phase-ic"><Icon name={ph.icon}/></span><small>Phase {pi+1}</small><h2 id={`${ph.id}-title`}>{ph.name}</h2><p>{ph.line}</p></div>
        <ol className="hiw-steps">{ph.steps.map(i=>{const[t,d]=journey[i];return <li className="hiw-step" key={t}><span className="hiw-node" aria-hidden="true">{String(i+1).padStart(2,"0")}</span><div className="hiw-card"><h3>{t}</h3><p>{d}</p><span className="hiw-result"><Icon name="check"/>{stepResults[i]}</span></div></li>})}</ol>
        {ph.id==="collect"&&<div className="hiw-pickup" id="pickup">
          <h3>Collecting your reservation</h3><p>Wait until your reservation is marked Ready for Pickup before visiting the counter.</p>
          <ol className="hiw-flow" aria-label="Pickup process">{[["pin","Arrive on campus"],["store","Go to the pickup counter"],["queue","Join the queue"],["check","Collect your items"]].map(([ic,t])=><li key={t}><span className="ic"><Icon name={ic as "pin"}/></span>{t}</li>)}</ol>
          <dl className="hiw-facts">
            <div><dt><Icon name="pin"/>Where</dt><dd>The Bulldogs Xchange pickup counter at NU Fairview. Shipping and delivery are not available.</dd></div>
            <div><dt><Icon name="id"/>What to bring</dt><dd>Your school ID and your reservation reference.</dd></div>
            <div><dt><Icon name="clock"/>When</dt><dd>Once the reservation is Ready for Pickup and before the expiry time shown with it.</dd></div>
            <div><dt><Icon name="queue"/>At the counter</dt><dd>Join the pickup queue from your account. Staff call your number, process payment and release your items.</dd></div>
          </dl>
        </div>}
      </section>)}
    </div>
    <section className="container hiw-faq" aria-labelledby="faq-title"><div className="sr-head"><div><span className="eyebrow">Questions</span><h2 id="faq-title" className="display sm">Good to know.</h2></div></div>
      <div className="faq-list">{faq.map(([q,a])=><details key={q}><summary>{q}<Icon name="plus"/></summary><p>{a}</p></details>)}</div>
    </section>
    <section className="container hiw-end"><div className="hiw-end-card"><div><h2>Ready to browse?</h2><p>See what is available now at the Xchange.</p></div><div className="row"><NavLink className="btn btn-gold btn-lg" to="/catalog">Browse merchandise<Icon name="arrow"/></NavLink>{!session?.authenticated&&(isStaticPreview?<span className="hiw-note">Account registration is not available on this page.</span>:<button type="button" className="btn btn-secondary btn-lg" onClick={()=>openAuth("register")}>Create account</button>)}</div></div></section>
  </div>}

export function NotFound(){return <section className="container page narrow"><div className="state"><span className="state-icon"><Icon name="search"/></span><span className="eyebrow">404</span><h1>Page not found</h1><p>The page you requested is not part of Bulldogs Xchange.</p><NavLink className="btn" to="/">Return home</NavLink></div></section>}
