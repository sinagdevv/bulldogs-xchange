import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it,vi} from "vitest";
import {AuthPanel} from "./account";
import {AppLayout,Header,RequireRole} from "./components";
import {SessionContext,type SessionState} from "./session-context";
import type {Session,User} from "./types";

const user:User={id:"1",email:"student@students.nu-fairview.edu.ph",displayName:"Student",role:"Customer"};
const state=(session:Session|null,authOpen=false):SessionState=>({session,loading:false,error:null,authOpen,api:{} as SessionState["api"],login:vi.fn(),register:vi.fn(),requestPasswordReset:vi.fn(),openAuth:vi.fn(),closeAuth:vi.fn(),logout:vi.fn(),reload:vi.fn()});
const render=(node:React.ReactNode,value:SessionState)=>renderToStaticMarkup(<SessionContext.Provider value={value}><MemoryRouter>{node}</MemoryRouter></SessionContext.Provider>);

describe("authentication navigation",()=>{
  it("shows Log in only for anonymous and logged-out visitors",()=>{for(const session of [null,{authenticated:false,user:null}]){const html=render(<Header/>,state(session));expect(html).toContain("Log in");expect(html).not.toContain("Open account");expect(html).not.toContain("Log out")}});
  it("shows account navigation and Log out for authenticated users",()=>{const html=render(<Header/>,state({authenticated:true,user}));expect(html).toContain('href="/home"');expect(html).toContain("Open account");expect(html).toContain("Log out");expect(html).not.toContain(">Log in<")});
  it("offers Forgot password on login only, never on registration",()=>{const login=render(<AuthPanel/>,state({authenticated:false,user:null},true));expect(login).toContain("Forgot password?");const register=render(<AuthPanel/>,{...state({authenticated:false,user:null},true),authMode:"register"});expect(register).not.toContain("Forgot password?")});
  it("blocks pending accounts from protected content",()=>{const pending={...user,approvalStatus:"pending" as const};const html=render(<RequireRole roles={["Customer"]}><span>Protected reservation</span></RequireRole>,state({authenticated:true,user:pending}));expect(html).toContain("Pending Admin approval");expect(html).not.toContain("Protected reservation")});
  it("blocks protected content after logout",()=>{const html=render(<RequireRole roles={["Customer"]}><span>Protected reservation</span></RequireRole>,state({authenticated:false,user:null}));expect(html).toContain("Sign in required");expect(html).not.toContain("Protected reservation")});
  it("removes every role workspace after logout",()=>{for(const role of ["Customer","Staff","Admin"] as const){const html=render(<AppLayout role={role}/>,state({authenticated:false,user:null}));expect(html).not.toContain("app-frame");expect(html).not.toContain(`${role} navigation`)}});
  it("renders Student ID and password login when open",()=>{const html=render(<AuthPanel/>,state({authenticated:false,user:null},true));expect(html).toContain("Sign in to Bulldogs Xchange");expect(html).toContain("Student ID");expect(html).toContain('type="password"');expect(html).not.toContain("verification code")});
});
