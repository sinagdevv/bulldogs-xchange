import {describe,expect,it} from "vitest";
import {mapLimit} from "./concurrency";

describe("mapLimit",()=>{
  it("never runs more than the given limit of calls concurrently",async()=>{
    let active=0,maxActive=0;
    const items=Array.from({length:20},(_,i)=>i);
    await mapLimit(items,4,async(i)=>{
      active++;
      maxActive=Math.max(maxActive,active);
      await new Promise(r=>setTimeout(r,0));
      active--;
      return i*2;
    });
    expect(maxActive).toBeLessThanOrEqual(4);
  });

  it("maps every item and preserves input order in the result",async()=>{
    const items=["a","bb","ccc","dddd","e"];
    const result=await mapLimit(items,2,async(s)=>s.length);
    expect(result).toEqual([1,2,3,4,1]);
  });

  it("calls fn exactly once per item, with no repeated or skipped work",async()=>{
    const calls:number[]=[];
    const items=[10,20,30,40,50,60,70];
    await mapLimit(items,3,async(i)=>{calls.push(i);return i});
    expect(calls.slice().sort((a,b)=>a-b)).toEqual(items.slice().sort((a,b)=>a-b));
    expect(calls).toHaveLength(items.length);
  });

  it("propagates a failed request to the caller instead of swallowing it",async()=>{
    const items=[1,2,3,4,5];
    await expect(mapLimit(items,2,async(i)=>{
      if(i===3)throw new Error("boom");
      return i;
    })).rejects.toThrow("boom");
  });

  it("handles an empty list without invoking fn",async()=>{
    let calls=0;
    const result=await mapLimit([],4,async()=>{calls++;return null});
    expect(result).toEqual([]);
    expect(calls).toBe(0);
  });

  it("never starts more workers than there are items, even with a larger limit",async()=>{
    let starts=0;
    await mapLimit([1,2],10,async(i)=>{starts++;return i});
    expect(starts).toBe(2);
  });
});
