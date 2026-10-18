/** Bounded-concurrency map: runs at most `limit` calls to `fn` at once instead of firing all of
 * them in parallel. Used to avoid exhausting the backend connection pool (POSTGRES_POOL_MAX) when
 * a view needs one request per row of a list (e.g. a variants lookup per product). Preserves input
 * order in the result array; a rejection from `fn` propagates to the caller, same as Promise.all
 * would, after in-flight work settles. */
export async function mapLimit<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]>{
  const results:R[]=new Array(items.length);
  let next=0;
  async function worker(){
    for(;;){
      const i=next++;
      if(i>=items.length)return;
      results[i]=await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({length:Math.max(1,Math.min(limit,items.length))},worker));
  return results;
}
