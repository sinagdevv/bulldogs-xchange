import {describe,expect,it} from "vitest";
import {canReserveAvailability,stockLabel,type AvailabilityState} from "./customer";

const available={productVariantId:"variant-1",physicalQuantity:2,reservedQuantity:0,reorderLevel:1,availableQuantity:2,status:"Healthy"} as const;

describe("customer catalog availability",()=>{
  it("keeps missing inventory pending and non-reservable",()=>{
    const state:AvailabilityState={kind:"pending"};
    expect(stockLabel(state)).toBe("Inventory verification pending");
    expect(canReserveAvailability(state)).toBe(false);
  });
  it("distinguishes an availability API failure from zero verified stock",()=>{
    expect(stockLabel({kind:"error"})).toBe("Unable to retrieve availability");
    expect(stockLabel({kind:"ready",stock:[]},{...available,availableQuantity:0})).toBe("Out of stock");
  });
  it("allows reservation only for a verified positive availability record",()=>{
    const state:AvailabilityState={kind:"ready",stock:[available]};
    expect(canReserveAvailability(state,available)).toBe(true);
    expect(canReserveAvailability(state,{...available,availableQuantity:0})).toBe(false);
  });
});
