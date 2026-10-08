import type {Role,User} from "./types";

export interface AuthAdapter{getAccessToken(signal?:AbortSignal):Promise<string|null>;getFixtureUser():User|null}
export const fixtureAuthMode=import.meta.env.DEV&&import.meta.env.VITE_ENABLE_FIXTURE_AUTH==="true";
type Auth0Bridge={getAccessTokenSilently(options?:{authorizationParams?:Record<string,string>}):Promise<string>};
declare global{interface Window{bulldogsAuth0?:Auth0Bridge}}

export class Auth0Adapter implements AuthAdapter{
  constructor(private bridge:Auth0Bridge|undefined=window.bulldogsAuth0){}
  async getAccessToken(){return this.bridge?this.bridge.getAccessTokenSilently():null;}
  getFixtureUser(){return null;}
}

class FixtureAuthAdapter implements AuthAdapter{
  private user:User={id:"fixture-customer",email:"customer@example.test",displayName:"Alex Bulldog",role:(import.meta.env.VITE_FIXTURE_ROLE??"Customer") as Role,department:"NU Fairview"};
  async getAccessToken(){return null;}
  getFixtureUser(){return this.user;}
}

export function createAuthAdapter():AuthAdapter{
  if(fixtureAuthMode)return new FixtureAuthAdapter();
  return new Auth0Adapter();
}
