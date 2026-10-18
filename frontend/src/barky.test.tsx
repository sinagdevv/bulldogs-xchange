import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it,vi} from "vitest";
import {BarkyBubble,BarkyHero,BarkyMascot,BarkyWidget,type BarkyMascotState} from "./barky";
import {SessionContext,type SessionState} from "./session-context";

// BarkyWidget only needs api.request to exist -- it is never called while the widget is closed (idle).
const state:SessionState={session:null,loading:false,error:null,authOpen:false,api:{request:vi.fn()} as unknown as SessionState["api"],login:vi.fn(),startGoogleSignIn:vi.fn(),completeGoogleSignIn:vi.fn(),loginOtp:vi.fn(),requestOtp:vi.fn(),register:vi.fn(),requestPasswordReset:vi.fn(),openAuth:vi.fn(),closeAuth:vi.fn(),logout:vi.fn(),reload:vi.fn()};
const render=(path:string)=>renderToStaticMarkup(<SessionContext.Provider value={state}><MemoryRouter initialEntries={[path]}><BarkyWidget/></MemoryRouter></SessionContext.Provider>);

describe("Barky landing-page opt-out",()=>{
  it("never renders on the public landing page",()=>{
    expect(render("/")).toBe("");
  });

  it("still renders its launcher on other public and authenticated routes",()=>{
    for(const path of ["/catalog","/how-it-works","/home","/staff","/admin"]){
      expect(render(path)).toContain("barky-launcher");
    }
  });
});

describe("Barky mascot states",()=>{
  const mascot=(state:BarkyMascotState)=>renderToStaticMarkup(<BarkyMascot state={state}/>);

  it("gives each state its own root class so idle/happy/thinking/responding/error drive distinct CSS animations",()=>{
    for(const state of ["idle","happy","thinking","responding","error"] as const){
      expect(mascot(state)).toContain(`barky-mascot-${state}`);
    }
  });

  it("renders a raised paw only for the happy greeting state",()=>{
    expect(mascot("happy")).toContain("barky-paw");
    for(const state of ["idle","thinking","responding","error"] as const)expect(mascot(state)).not.toContain("barky-paw");
  });

  it("renders bobbing thought bubbles only for the thinking state",()=>{
    expect(mascot("thinking")).toContain("barky-think-1");
    for(const state of ["idle","happy","responding","error"] as const)expect(mascot(state)).not.toContain("barky-think-1");
  });

  it("renders a sweat drop only for the error state, and a toothy grin only for the others",()=>{
    expect(mascot("error")).toContain("barky-sweat");
    for(const state of ["idle","happy","thinking","responding"] as const){
      const html=mascot(state);
      expect(html).not.toContain("barky-sweat");
      expect(html).toContain("barky-mouth"); // open grin group, not the error "oh" path
    }
  });

  it("defaults to the idle state when none is given",()=>{
    expect(renderToStaticMarkup(<BarkyMascot/>)).toContain("barky-mascot-idle");
  });
});

describe("Barky degraded-reply card (the AI-unavailable fix)",()=>{
  const bubble=(onRetry?:()=>void)=>renderToStaticMarkup(
    <BarkyBubble msg={{id:"a1",role:"assistant",content:"Barky's AI is temporarily unavailable. Please use the live catalog for current merchandise availability or contact the Xchange team.",ts:Date.now(),degraded:true}} onRetry={onRetry}/>
  );

  it("renders a distinct notice card instead of a plain reply bubble",()=>{
    const html=bubble();
    expect(html).toContain("barky-degraded-card");
    expect(html).toContain("Running without AI right now");
  });

  it("shows a retry action only when the caller supplies one",()=>{
    expect(bubble(()=>{})).toContain("Try again");
    expect(bubble()).not.toContain("Try again");
  });

  it("leaves an ordinary assistant reply as a plain bubble with no notice card",()=>{
    const html=renderToStaticMarkup(<BarkyBubble msg={{id:"a2",role:"assistant",content:"Here's what we carry.",ts:Date.now()}}/>);
    expect(html).not.toContain("barky-degraded-card");
  });
});

describe("Barky empty-state hero",()=>{
  it("renders a centered idle mascot with a glow and greeting copy",()=>{
    const html=renderToStaticMarkup(<BarkyHero/>);
    expect(html).toContain("barky-hero-glow");
    expect(html).toContain("barky-mascot-idle");
    expect(html).toContain("Hey, I");
  });
});
