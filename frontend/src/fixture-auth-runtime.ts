import type {AuthAdapter} from "./auth";
import type {Role,User} from "./types";

export const fixtureAuthMode=import.meta.env.DEV&&import.meta.env.VITE_ENABLE_FIXTURE_AUTH==="true";
class FixtureAuthAdapter implements AuthAdapter{private role=(import.meta.env.VITE_FIXTURE_ROLE??"Customer") as Role;private user:User={id:`fixture-${this.role.toLowerCase()}`,email:({Customer:"customer@example.test",Staff:"staff@example.test",Admin:"admin@example.test"} as const)[this.role],displayName:this.role==="Customer"?"Alex Bulldog":`Demo ${this.role}`,role:this.role,department:"NU Fairview",approvalStatus:"approved"};async getAccessToken(){return null;}async login(){}async requestOtp(){}async verifyOtp(){}async register(){}async requestPasswordReset(){}async logout(){}getFixtureUser(){return this.user;}}
export const createFixtureAuthAdapter=()=>new FixtureAuthAdapter();
