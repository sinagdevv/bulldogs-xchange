import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
describe("Vercel bootstrap configuration",()=>{
  it("builds the real frontend while installing API and frontend dependencies",()=>{const config=JSON.parse(readFileSync("vercel.json","utf8"));expect(config.installCommand).toBe("npm ci && npm ci --prefix frontend");expect(config.buildCommand).toBe("npm --prefix frontend run build");expect(config.outputDirectory).toBe("frontend/dist")});
  it("routes API functions before the SPA fallback",()=>{const config=JSON.parse(readFileSync("vercel.json","utf8"));expect(config.routes).toEqual([{handle:"filesystem"},{src:"/api/(.*)",dest:"/api/[...path]"},{src:"/(.*)",dest:"/index.html"}])});
  it("contains no protected Supabase target or secret-shaped public variable",()=>{const config=readFileSync("vercel.json","utf8");expect(config).not.toContain("miwodndxgrdyanrloxig");expect(config).not.toMatch(/VITE_.*(?:SECRET|SERVICE_ROLE|DATABASE_URL)/)});
});
