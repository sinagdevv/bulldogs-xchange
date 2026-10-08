import type {AuthAdapter} from "./auth";
import {fixtureAvailability,fixtureCategories,fixtureNotifications,fixtureProducts,fixtureQueue,fixtureReservations,fixtureSession,fixtureUser,fixtureVariants} from "./fixtures";
import type {ApiFailure,ApiSuccess,Availability,CatalogQuery,Category,Notification,Product,QueueRecord,QueueSummary,Reservation,Session,User,Variant} from "./types";

export class ApiError extends Error{constructor(readonly code:string,message:string,readonly status:number){super(message);}}
const object=(value:unknown):value is Record<string,unknown>=>typeof value==="object"&&value!==null;
export const fixtureMode=import.meta.env.DEV&&import.meta.env.MODE!=="test"&&import.meta.env.VITE_ENABLE_API_FIXTURES==="true";
const fixtureState={reservations:structuredClone(fixtureReservations),queue:structuredClone(fixtureQueue),notifications:structuredClone(fixtureNotifications)};

function fixtureRequest<T>(path:string,init:RequestInit):T{
  const method=init.method??"GET",[route,query=""]=path.replace(/^\//,"").split("?");
  if(method==="GET"&&route==="session")return fixtureSession as T;
  if(method==="GET"&&(route==="me"||route==="profile"))return fixtureUser as T;
  if(method==="GET"&&route==="categories")return fixtureCategories as T;
  if(method==="GET"&&route==="products"){
    const params=new URLSearchParams(query),search=params.get("search")?.toLowerCase(),category=params.get("category"),sort=params.get("sort");
    const items=fixtureProducts.filter(p=>(!search||`${p.title} ${p.description} ${p.sku}`.toLowerCase().includes(search))&&(!category||p.categoryId===category)&&(params.get("featured")!=="true"||p.isFeatured));
    return items.sort(sort==="price"?(a,b)=>a.price-b.price:sort==="-price"?(a,b)=>b.price-a.price:(a,b)=>a.title.localeCompare(b.title)) as T;
  }
  const productMatch=route.match(/^products\/([^/]+)$/);if(method==="GET"&&productMatch){const item=fixtureProducts.find(p=>p.id===decodeURIComponent(productMatch[1]!));if(!item)throw new ApiError("NOT_FOUND","Product not found.",404);return item as T;}
  const variantsMatch=route.match(/^products\/([^/]+)\/variants$/);if(method==="GET"&&variantsMatch)return fixtureVariants.filter(v=>v.productId===decodeURIComponent(variantsMatch[1]!)) as T;
  const availabilityMatch=route.match(/^products\/([^/]+)\/availability$/);if(method==="GET"&&availabilityMatch){const ids=new Set(fixtureVariants.filter(v=>v.productId===decodeURIComponent(availabilityMatch[1]!)).map(v=>v.id));return fixtureAvailability.filter(a=>ids.has(a.productVariantId)) as T;}
  if(method==="GET"&&route==="reservations")return fixtureState.reservations.filter(r=>r.customerEmail.toLowerCase()===fixtureUser.email.toLowerCase()) as T;
  const reservationMatch=route.match(/^reservations\/([^/]+)$/);if(method==="GET"&&reservationMatch){const item=fixtureState.reservations.find(r=>r.id===decodeURIComponent(reservationMatch[1]!)&&r.customerEmail===fixtureUser.email);if(!item)throw new ApiError("NOT_FOUND","Reservation not found.",404);return item as T;}
  if(method==="POST"&&route==="reservations"){const body=JSON.parse(String(init.body)) as {items:{productVariantId:string;quantity:number}[]};for(const item of body.items){const stock=fixtureAvailability.find(a=>a.productVariantId===item.productVariantId);if(!stock||item.quantity>stock.availableQuantity)throw new ApiError("INSUFFICIENT_STOCK","Insufficient stock.",409);}const id=String(fixtureState.reservations.length+1),now=new Date().toISOString(),reservation:Reservation={id,reference:`BX-2026-${id.padStart(4,"0")}`,customerEmail:fixtureUser.email,status:"Pending",expiresAt:new Date(Date.now()+259200000).toISOString(),createdAt:now,updatedAt:now};fixtureState.reservations.unshift(reservation);return reservation as T;}
  const cancelMatch=route.match(/^reservations\/([^/]+)\/cancel$/);if(method==="POST"&&cancelMatch){const item=fixtureState.reservations.find(r=>r.id===decodeURIComponent(cancelMatch[1]!)&&r.customerEmail===fixtureUser.email);if(!item)throw new ApiError("NOT_FOUND","Reservation not found.",404);if(!["Pending","Confirmed"].includes(item.status))throw new ApiError("INVALID_RESERVATION_STATUS","Reservation cannot be cancelled.",409);item.status="Cancelled";item.updatedAt=new Date().toISOString();return item as T;}
  if(method==="GET"&&route==="queue/me")return fixtureState.queue.filter(q=>q.customerEmail===fixtureUser.email&&["Waiting","Serving"].includes(q.status)) as T;
  if(method==="GET"&&route==="queue/status")return {waiting:fixtureState.queue.filter(q=>q.status==="Waiting").length,serving:fixtureState.queue.filter(q=>q.status==="Serving").map(q=>q.queueNumber)} as T;
  if(method==="POST"&&route==="queue/join"){const body=JSON.parse(String(init.body)) as {reservationId:string;queueType:"Express"|"Regular"},reservation=fixtureState.reservations.find(r=>r.id===body.reservationId&&r.customerEmail===fixtureUser.email);if(!reservation)throw new ApiError("NOT_FOUND","Reservation not found.",404);if(reservation.status!=="Ready for Pickup")throw new ApiError("INVALID_RESERVATION_STATUS","Reservation is not ready for pickup.",409);const q:QueueRecord={id:String(fixtureState.queue.length+1),queueNumber:`${body.queueType==="Express"?"E":"R"}-${String(fixtureState.queue.length+1).padStart(3,"0")}`,customerEmail:fixtureUser.email,reservationId:body.reservationId,queueType:body.queueType,status:"Waiting",queueDate:new Date().toISOString()};fixtureState.queue.push(q);return q as T;}
  if(method==="POST"&&route==="queue/leave"){const q=fixtureState.queue.find(x=>x.customerEmail===fixtureUser.email&&x.status==="Waiting");if(!q)throw new ApiError("QUEUE_NOT_FOUND","Waiting queue entry not found.",404);q.status="Left";return q as T;}
  if(method==="GET"&&route==="notifications")return fixtureState.notifications.filter(n=>n.recipientEmail===fixtureUser.email) as T;
  const noteMatch=route.match(/^notifications\/([^/]+)\/read$/);if(method==="POST"&&noteMatch){const note=fixtureState.notifications.find(n=>n.id===decodeURIComponent(noteMatch[1]!)&&n.recipientEmail===fixtureUser.email);if(!note)throw new ApiError("NOT_FOUND","Notification not found.",404);note.isRead=true;return {id:note.id,isRead:true} as T;}
  if(method==="POST"&&route==="notifications/read-all"){const unread=fixtureState.notifications.filter(n=>n.recipientEmail===fixtureUser.email&&!n.isRead);unread.forEach(n=>n.isRead=true);return {updated:unread.length} as T;}
  throw new ApiError("NOT_FOUND","Fixture route not found.",404);
}

export class ApiClient{
  constructor(private auth:AuthAdapter,private baseUrl=import.meta.env.VITE_API_BASE_URL??"/api"){}
  async request<T>(path:string,init:RequestInit={}):Promise<T>{
    if(fixtureMode)return structuredClone(fixtureRequest<T>(path,init));
    const token=await this.auth.getAccessToken(init.signal??undefined),headers=new Headers(init.headers);headers.set("Accept","application/json");if(init.body)headers.set("Content-Type","application/json");if(token)headers.set("Authorization",`Bearer ${token}`);
    let response:Response;try{response=await fetch(`${this.baseUrl}/${path.replace(/^\//,"")}`,{...init,headers});}catch(error){if(error instanceof DOMException&&error.name==="AbortError")throw error;throw new ApiError("NETWORK_ERROR","The service is currently unreachable.",0);}
    const payload:unknown=await response.json().catch(()=>null);if(!response.ok){const failure=object(payload)&&payload.success===false?payload as unknown as ApiFailure:null;throw new ApiError(failure?.error.code??"REQUEST_FAILED",failure?.error.message??"The request could not be completed.",response.status);}if(!object(payload)||payload.success!==true||!("data" in payload))throw new ApiError("INVALID_RESPONSE","The service returned an invalid response.",response.status);return (payload as unknown as ApiSuccess<T>).data;
  }
  session(signal?:AbortSignal){const fixture=this.auth.getFixtureUser();return fixture?Promise.resolve<Session>({authenticated:true,user:fixture}):this.request<Session>("session",{signal});}
  onboard(input:{schoolId:string;fullName:string;customerType:string;departmentId?:number}){return this.request<User>("onboarding/customer",{method:"POST",body:JSON.stringify(input)});}
  profile(signal?:AbortSignal){return this.request<User>("profile",{signal});}categories(signal?:AbortSignal){return this.request<Category[]>("categories",{signal});}
  products(queryOrSignal:CatalogQuery|AbortSignal={},signal?:AbortSignal){const query=queryOrSignal instanceof AbortSignal?{}:queryOrSignal,requestSignal=queryOrSignal instanceof AbortSignal?queryOrSignal:signal,params=new URLSearchParams({active:"true"});Object.entries(query).forEach(([k,v])=>{if(v!==undefined&&v!=="")params.set(k,String(v));});return this.request<Product[]>(`products?${params}`,{signal:requestSignal});}
  product(id:string,signal?:AbortSignal){return this.request<Product>(`products/${encodeURIComponent(id)}`,{signal});}variants(id:string,signal?:AbortSignal){return this.request<Variant[]>(`products/${encodeURIComponent(id)}/variants`,{signal});}availability(id:string,signal?:AbortSignal){return this.request<Availability[]>(`products/${encodeURIComponent(id)}/availability`,{signal});}
  reservations(signal?:AbortSignal){return this.request<Reservation[]>("reservations",{signal});}reservation(id:string,signal?:AbortSignal){return this.request<Reservation>(`reservations/${encodeURIComponent(id)}`,{signal});}createReservation(items:{productVariantId:string;quantity:number}[]){return this.request<Reservation>("reservations",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:JSON.stringify({items})});}cancelReservation(id:string){return this.request<Reservation>(`reservations/${encodeURIComponent(id)}/cancel`,{method:"POST"});}
  myQueue(signal?:AbortSignal){return this.request<QueueRecord[]>("queue/me",{signal});}queueStatus(signal?:AbortSignal){return this.request<QueueSummary>("queue/status",{signal});}joinQueue(reservationId:string,queueType:"Express"|"Regular"){return this.request<QueueRecord>("queue/join",{method:"POST",body:JSON.stringify({reservationId,queueType})});}leaveQueue(){return this.request<QueueRecord>("queue/leave",{method:"POST"});}
  notifications(signal?:AbortSignal){return this.request<Notification[]>("notifications",{signal});}markRead(id:string){return this.request<{id:string;isRead:true}>(`notifications/${encodeURIComponent(id)}/read`,{method:"POST"});}markAllRead(){return this.request<{updated:number}>("notifications/read-all",{method:"POST"});}
}
