import {describe,expect,it} from "vitest";
import config from "./vite.config";

const resolve=(command:"serve"|"build")=>typeof config==="function"?config({command,mode:command==="build"?"production":"development",isPreview:false,isSsrBuild:false}):config;

describe("Vite React runtime",()=>{
  it("pre-bundles React entry points in one optimized pass so only one React copy exists",async()=>{
    const resolved=await resolve("serve");
    const include=resolved.optimizeDeps?.include??[];
    for(const dep of ["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime","react-router-dom"])expect(include).toContain(dep);
    expect(resolved.optimizeDeps?.exclude??[]).not.toEqual(expect.arrayContaining(["react","react-dom"]));
    expect(resolved.resolve?.dedupe).toEqual(expect.arrayContaining(["react","react-dom"]));
  });
  it("swaps fixture modules for static stubs in every production build",async()=>{
    const aliases=(await resolve("build")).resolve?.alias as {find:string;replacement:string}[];
    expect(aliases.map(a=>a.find)).toEqual(expect.arrayContaining(["./fixture-data","./fixture-auth-runtime"]));
  });
});
