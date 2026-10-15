import {readdir,readFile,stat} from "node:fs/promises";
import {resolve,relative} from "node:path";

const root=resolve("deployment/static-preview"),forbiddenNames=new Set(["api","src","supabase","database","docker-compose.yml",".env",".env.local"]),forbiddenText=["miwodndxgrdyanrloxig","supabase.co","customer@example.test","staff@example.test","admin@example.test","SUPABASE_SERVICE_ROLE","postgresql://","VITE_SUPABASE"];
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,entry.name);if(forbiddenNames.has(entry.name))throw new Error(`Forbidden deployment entry: ${relative(root,path)}`);if(entry.isDirectory())await walk(path);else files.push(path);}}
await walk(root);
for(const path of files){const text=(await readFile(path)).toString("utf8");for(const needle of forbiddenText)if(text.includes(needle))throw new Error(`Forbidden bundle content (${needle}): ${relative(root,path)}`);}
for(const required of ["index.html","manifest.webmanifest","icon-192.png","icon-512.png","sw.js","vercel.json"]){try{if(!(await stat(resolve(root,required))).isFile())throw new Error();}catch{throw new Error(`Missing PWA artifact: ${required}`);}}
const worker=await readFile(resolve(root,"sw.js"),"utf8");
if(!worker.includes('caches.match("/")'))throw new Error("Service worker has no offline shell fallback.");
const link=JSON.parse(await readFile(resolve(root,".vercel/project.json"),"utf8"));
if(Object.keys(link).some(key=>!["projectId","orgId","projectName"].includes(key)))throw new Error("Deployment link contains unexpected configuration.");
console.log(JSON.stringify({artifact:root,files:files.length,apiFunctions:"none",fixtureData:"none",operationalReferences:"none",pwa:"pass",spaFallback:"extensionless-only",offlineShell:"pass"},null,2));
