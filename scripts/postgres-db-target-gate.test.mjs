import assert from "node:assert/strict";

const script=new URL("./postgres-db.mjs",import.meta.url);
const run=async(env)=>{
  const child=await import("node:child_process");
  return new Promise(resolve=>child.execFile(process.execPath,[script,"integrity"],{env:{...process.env,...env}},error=>resolve(error)));
};

assert.ok(await run({SUPABASE_DATABASE_URL:"postgresql://postgres.miwodndxgrdyanrloxig:secret@pooler.example.test/postgres",SUPABASE_PROJECT_REF:"miwodndxgrdyanrloxig"}));
assert.ok(await run({SUPABASE_DATABASE_URL:"postgresql://postgres.demo-ref:secret@pooler.example.test/postgres",SUPABASE_PROJECT_REF:"other-ref",HOSTED_DEMO_SUPABASE_PROJECT_REF:"demo-ref"}));
assert.ok(await run({SUPABASE_DATABASE_URL:"postgresql://postgres.demo-ref:secret@pooler.example.test/postgres",SUPABASE_PROJECT_REF:"demo-ref",HOSTED_DEMO_SUPABASE_PROJECT_REF:""}));
console.log("Postgres target gate: PASS");
