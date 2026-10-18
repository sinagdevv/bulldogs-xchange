import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it,vi} from "vitest";
import {BarkyWidget} from "./barky";
import {SessionContext,type SessionState} from "./session-context";

// BarkyWidget only needs api.request to exist -- it is never called while the widget is closed (idle).
const state:SessionState={session:null,loading:false,error:null,authOpen:false,api:{request:vi.fn()} as unknown as SessionState["api"],login:vi.fn(),loginOtp:vi.fn(),requestOtp:vi.fn(),register:vi.fn(),requestPasswordReset:vi.fn(),openAuth:vi.fn(),closeAuth:vi.fn(),logout:vi.fn(),reload:vi.fn()};
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
