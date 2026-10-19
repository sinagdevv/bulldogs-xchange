const CACHE="bulldogs-static-v4";
const CORE=["/","/manifest.webmanifest","/favicon-16.png","/favicon-32.png","/favicon-48.png","/apple-touch-icon.png","/icon-192.png","/icon-512.png","/nu-crest.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin||url.pathname.startsWith("/api/"))return;
  if(request.mode==="navigate"){event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response}).catch(()=>caches.match(request).then(hit=>hit||caches.match("/"))));return;}
  if(!["image","style","script","font"].includes(request.destination))return;
  event.respondWith(caches.match(request).then(cached=>{
    const fresh=fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response});
    return fresh.catch(()=>cached);
  }));
});

