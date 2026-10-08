import {describe,expect,it} from "vitest";
import {belongsToCustomer,reservationValidation,viewState} from "./customer-rules";
import type {Reservation} from "./types";

const reservation:Reservation={id:"1",reference:"BX-1",customerEmail:"student@nu.test",status:"Pending",expiresAt:"2026-10-10T00:00:00Z",createdAt:"2026-10-08T00:00:00Z",updatedAt:"2026-10-08T00:00:00Z"};
describe("customer reservation rules",()=>{
  it("rejects invalid or unavailable quantities",()=>{expect(reservationValidation(0,4)).toMatch("at least 1");expect(reservationValidation(1.5,4)).toMatch("whole");expect(reservationValidation(5,4)).toBe("Only 4 available.");expect(reservationValidation(4,4)).toBeNull();});
  it("keeps reservations inside the signed-in customer boundary",()=>{expect(belongsToCustomer(reservation,"STUDENT@nu.test")).toBe(true);expect(belongsToCustomer(reservation,"other@nu.test")).toBe(false);});
  it("selects loading, error, empty, and content states",()=>{expect(viewState(true,"",0)).toBe("loading");expect(viewState(false,"offline",0)).toBe("error");expect(viewState(false,"",0)).toBe("empty");expect(viewState(false,"",1)).toBe("content");});
});
