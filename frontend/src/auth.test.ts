import {afterEach,describe,expect,it,vi} from "vitest";
import {Auth0Adapter} from "./auth";

afterEach(()=>vi.unstubAllGlobals());
describe("Auth0 login UI actions",()=>{
  it("starts login and logout through the SPA bridge",async()=>{vi.stubGlobal("window",{location:{origin:"https://app.example.test"}});const bridge={getAccessTokenSilently:vi.fn(async()=>"token"),loginWithRedirect:vi.fn(async()=>{}),logout:vi.fn(async()=>{})};const auth=new Auth0Adapter(bridge);await auth.login();expect(bridge.loginWithRedirect).toHaveBeenCalledWith({authorizationParams:{audience:undefined,redirect_uri:"https://app.example.test"}});await auth.logout();expect(bridge.logout).toHaveBeenCalledWith({logoutParams:{returnTo:"https://app.example.test"}});});
});
