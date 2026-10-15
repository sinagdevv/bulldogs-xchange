import {createReadStream,existsSync} from "node:fs";
import {createServer,request} from "node:http";
import {extname,join,normalize,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../frontend/dist/",import.meta.url))),types={".css":"text/css",".html":"text/html",".js":"text/javascript",".svg":"image/svg+xml",".webp":"image/webp",".png":"image/png",".json":"application/json"};
const server=createServer((client,response)=>{
  const url=new URL(client.url??"/","http://127.0.0.1");
  if(url.pathname.startsWith("/api/")){const upstream=request({host:"127.0.0.1",port:4317,path:url.pathname+url.search,method:client.method,headers:{...client.headers,host:"127.0.0.1:4317"}},api=>{response.writeHead(api.statusCode??502,api.headers);api.pipe(response)});upstream.on("error",()=>{response.writeHead(502,{"content-type":"application/json"});response.end('{"success":false,"error":{"message":"Local API is unavailable"}}')});client.pipe(upstream);return;}
  const requested=normalize(join(root,url.pathname==="/"?"index.html":url.pathname));
  const file=requested.startsWith(root)&&existsSync(requested)?requested:join(root,"index.html");
  response.writeHead(200,{"content-type":`${types[extname(file)]??"application/octet-stream"}; charset=utf-8`,"cache-control":file.endsWith("index.html")?"no-cache":"public, max-age=3600"});createReadStream(file).pipe(response);
});
server.listen(4173,"localhost",()=>console.log("Local demo preview: http://localhost:4173"));
