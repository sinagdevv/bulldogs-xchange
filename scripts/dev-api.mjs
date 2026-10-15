import {createServer} from "node:http";

const port=Number(process.env.PORT??4317);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error("PORT must be a valid TCP port.");
if(process.env.LOCAL_DEMO==="true"&&(process.env.DATA_PROVIDER!=="postgres"||port!==4317||!process.env.SUPABASE_DATABASE_URL?.includes("127.0.0.1:55432")))throw new Error("Local demo must use PostgreSQL at 127.0.0.1:55432 on port 4317.");
const app=import("../dist/src/app.js");

const bodyOf=async request=>{
  if(request.method==="GET"||request.method==="HEAD")return undefined;
  const chunks=[];let size=0;
  for await(const chunk of request){size+=chunk.length;if(size>1_048_576)throw new Error("Request body is too large.");chunks.push(chunk)}
  if(!size)return undefined;
  const text=Buffer.concat(chunks).toString("utf8");
  return request.headers["content-type"]?.includes("application/json")?JSON.parse(text):text;
};

const server=createServer(async(request,response)=>{
  try{
    if(request.method==="GET"&&new URL(request.url??"/","http://localhost").pathname==="/api/health"){response.setHeader("Content-Type","application/json; charset=utf-8");response.end(JSON.stringify({success:true,data:{status:"healthy",service:"bulldogs-xchange"}}));return;}
    const url=new URL(request.url??"/",`http://${request.headers.host??"localhost"}`),query={};
    for(const [key,value] of url.searchParams){const current=query[key];query[key]=current===undefined?value:Array.isArray(current)?[...current,value]:[current,value]}
    const adapted={method:request.method,url:url.pathname+url.search,headers:request.headers,query,body:await bodyOf(request)};
    const reply={status(code){response.statusCode=code;return reply},setHeader(name,value){response.setHeader(name,value)},json(value){response.setHeader("Content-Type","application/json; charset=utf-8");response.end(JSON.stringify(value))},end(body){response.end(body)}};
    await (await app).handle(adapted,reply);
  }catch(error){
    response.statusCode=error instanceof SyntaxError?400:error instanceof Error&&error.message==="Request body is too large."?413:500;
    response.setHeader("Content-Type","application/json; charset=utf-8");
    response.setHeader("Cache-Control","no-store");
    response.end(JSON.stringify({success:false,error:{code:response.statusCode===400?"VALIDATION_ERROR":response.statusCode===413?"PAYLOAD_TOO_LARGE":"EXTERNAL_SERVICE_ERROR",message:response.statusCode===400?"Request body must be valid JSON.":response.statusCode===413?"Request body is too large.":"An unexpected error occurred."}}));
  }
});

server.listen(port,()=>console.log(`Bulldogs Xchange API listening on http://localhost:${port}`));
