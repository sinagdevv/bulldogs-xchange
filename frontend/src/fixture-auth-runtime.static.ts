import type {AuthAdapter} from "./auth";

/** The Preview alias points here, so fixture identities cannot enter its bundle. */
export const fixtureAuthMode=false;
export const createFixtureAuthAdapter=():AuthAdapter=>{throw new Error("Fixture authentication is unavailable in this HTTPS preview.");};
