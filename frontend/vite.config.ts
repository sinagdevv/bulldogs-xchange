import {defineConfig,loadEnv} from "vite";
import react from "@vitejs/plugin-react";
import {fileURLToPath} from "node:url";

const source=(name:string)=>fileURLToPath(new URL(`./src/${name}`,import.meta.url));
/* Fixture data and identities are dev-only; every production build (static or full-stack) swaps in the empty stubs. */
export default defineConfig(({mode,command})=>{const env={...loadEnv(mode,"..","") ,...process.env},staticPreview=env.VITE_STATIC_PREVIEW==="true"||command==="build";return {envDir:"..",plugins:[react()],resolve:{dedupe:["react","react-dom"],alias:staticPreview?[{find:"./fixture-data",replacement:source("fixture-data.static.ts")},{find:"./fixture-auth-runtime",replacement:source("fixture-auth-runtime.static.ts")}]:[]},optimizeDeps:{include:["react","react-dom","react-dom/client","react/jsx-runtime","react/jsx-dev-runtime","react-router-dom"]},server:{port:5173,strictPort:true,proxy:{"/api":process.env.BX_E2E_API_URL??"http://localhost:4317"}}};});
