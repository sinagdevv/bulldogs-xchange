import type {Role,User} from "./types";
import {createAuth0Client,type Auth0Client} from "@auth0/auth0-spa-js";

export interface AuthAdapter{getAccessToken(signal?:AbortSignal):Promise<string|null>;getFixtureUser():User|null;login():Promise<void>;logout():Promise<void>}
export const fixtureAuthMode=import.meta.env.DEV&&import.meta.env.VITE_ENABLE_FIXTURE_AUTH==="true";
type Auth0Bridge={getAccessTokenSilently(options?:{authorizationParams?:Record<string,string>}):Promise<string>;loginWithRedirect(options?:unknown):Promise<void>;logout(options?:unknown):Promise<void>};
declare global{interface Window{bulldogsAuth0?:Auth0Bridge}}

export class Auth0Adapter implements AuthAdapter{
  private client?:Promise<Auth0Client>;
  constructor(private bridge:Auth0Bridge|undefined=window.bulldogsAuth0){const domain=import.meta.env.VITE_AUTH0_DOMAIN,clientId=import.meta.env.VITE_AUTH0_CLIENT_ID,audience=import.meta.env.VITE_AUTH0_AUDIENCE;if(!bridge&&domain&&clientId&&audience)this.client=createAuth0Client({domain,clientId,cacheLocation:"memory",useRefreshTokens:false,authorizationParams:{audience,redirect_uri:window.location.origin}}).then(async client=>{if(location.search.includes("code=")&&location.search.includes("state=")){await client.handleRedirectCallback();history.replaceState({},document.title,location.pathname);}return client;});}
  private async auth0(){return this.bridge??await this.client;}
  async getAccessToken(){if(this.bridge)return this.bridge.getAccessTokenSilently();const client=await this.client;return client&&await client.isAuthenticated()?await client.getTokenSilently()??null:null;}
  async login(){const client=await this.auth0();if(!client)throw new Error("Auth0 is not configured.");await client.loginWithRedirect({authorizationParams:{audience:import.meta.env.VITE_AUTH0_AUDIENCE,redirect_uri:window.location.origin}});}
  async logout(){const client=await this.auth0();if(client)await client.logout({logoutParams:{returnTo:window.location.origin}});}
  getFixtureUser(){return null;}
}

class FixtureAuthAdapter implements AuthAdapter{
  private user:User={id:"fixture-customer",email:"customer@example.test",displayName:"Alex Bulldog",role:(import.meta.env.VITE_FIXTURE_ROLE??"Customer") as Role,department:"NU Fairview"};
  async getAccessToken(){return null;}
  async login(){}
  async logout(){}
  getFixtureUser(){return this.user;}
}

export function createAuthAdapter():AuthAdapter{
  if(fixtureAuthMode)return new FixtureAuthAdapter();
  return new Auth0Adapter();
}
