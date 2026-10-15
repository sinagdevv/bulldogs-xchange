import {cp,mkdir,readdir,readFile,rm,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {spawnSync} from "node:child_process";

const root=process.cwd(),frontend=resolve(root,"frontend"),artifact=resolve(root,"deployment/static-preview"),output=resolve(artifact,".vercel/output"),staticOutput=resolve(output,"static"),env={...process.env,NODE_ENV:"production",VITE_STATIC_PREVIEW:"true",VITE_ENABLE_FIXTURE_AUTH:"false",VITE_ENABLE_API_FIXTURES:"false",VITE_API_BASE_URL:"",VITE_SUPABASE_URL:"",VITE_SUPABASE_PUBLISHABLE_KEY:""};
for(const args of [[resolve(frontend,"node_modules/typescript/bin/tsc"),"-b"],[resolve(frontend,"node_modules/vite/bin/vite.js"),"build","--mode","production"]]){const result=spawnSync(process.execPath,args,{cwd:frontend,stdio:"inherit",env});if(result.status!==0)process.exit(result.status??1);}
await rm(artifact,{recursive:true,force:true});
await mkdir(artifact,{recursive:true});
await cp(resolve(frontend,"dist"),artifact,{recursive:true});
const shellAssets=(await readdir(resolve(artifact,"assets"))).filter(file=>/\.(?:js|css)$/.test(file)).map(file=>`/assets/${file}`);
const workerPath=resolve(artifact,"sw.js");
const worker=(await readFile(workerPath,"utf8")).replace(/const CORE=\[[^;]+;/,`const CORE=${JSON.stringify(["/","/manifest.webmanifest","/icon-192.png","/icon-512.png","/nu-crest.png",...shellAssets])};`);
await writeFile(workerPath,worker);
const spaRoute={source:"/((?!(?:api(?:/|$)|.*\\.)).*)",destination:"/index.html"};
await writeFile(resolve(artifact,"vercel.json"),JSON.stringify({rewrites:[spaRoute]},null,2)+"\n");
const {projectId,orgId,projectName}=JSON.parse(await readFile(resolve(root,".vercel/project.json"),"utf8"));
await mkdir(resolve(artifact,".vercel"),{recursive:true});
await writeFile(resolve(artifact,".vercel/project.json"),JSON.stringify({projectId,orgId,projectName},null,2)+"\n");
await mkdir(staticOutput,{recursive:true});
await cp(resolve(frontend,"dist"),staticOutput,{recursive:true});
await writeFile(resolve(staticOutput,"sw.js"),worker);
await writeFile(resolve(output,"config.json"),JSON.stringify({version:3,routes:[{handle:"filesystem"},{src:"/((?!(?:api(?:/|$)|.*\\.)).*)",dest:"/index.html"}]},null,2)+"\n");
console.log(`Static Preview artifact ready: ${artifact}`);
