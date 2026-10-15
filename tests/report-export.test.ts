import JSZip from "jszip";
import {describe,expect,it} from "vitest";
import XlsxPopulate from "xlsx-populate";
import {toPdf,toXlsx,type ReportType} from "../src/services/report-export-service.js";

const samples:Record<ReportType,Record<string,unknown>[]>={
  reservations:[{reference:"=CMD()",institutionalEmail:"student@students.nu-fairview.edu.ph",status:"Completed",createdAt:new Date("2026-10-01T10:00:00Z"),updatedAt:new Date("2026-10-01T11:00:00Z")}],
  "product-movement":[{sku:"S1",product:"Shirt",variant:"M",unitsReserved:5,unitsPickedUp:3}],
  inventory:[{sku:"S1",product:"Shirt",variant:"M",physicalQuantity:10,reservedQuantity:3,availableQuantity:7,reorderLevel:2}],
  pickups:[{transactionReference:"TX-1",reservationReference:"BX-1",institutionalEmail:"student@students.nu-fairview.edu.ph",recordedAmount:500,paymentMethod:"Cash",completedAt:new Date("2026-10-02T10:00:00Z")}],
};

describe("report exports",()=>{
  it.each(Object.keys(samples) as ReportType[])("creates %s XLSX with data and a native chart",async type=>{const data=await toXlsx(type,samples[type],{startDate:"2026-10-01",endDate:"2026-10-31"}),zip=await JSZip.loadAsync(data),workbook=await XlsxPopulate.fromDataAsync(data),chartName=Object.keys(zip.files).find(name=>/^xl\/charts\/chart\d+\.xml$/.test(name)),chartXml=chartName?await zip.file(chartName)!.async("string"):"";expect(data.subarray(0,2).toString()).toBe("PK");expect(workbook.sheet("Dashboard")).toBeTruthy();expect(workbook.sheet("Report Data")).toBeTruthy();expect(chartXml).toContain("Dashboard!");expect(chartXml).toMatch(/<c:v>[^<]+<\/c:v>/);expect(Object.keys(zip.files).some(name=>/^xl\/drawings\/drawing\d+\.xml$/.test(name))).toBe(true);});
  it("neutralizes spreadsheet formulas and supports empty datasets",async()=>{const injected=await XlsxPopulate.fromDataAsync(await toXlsx("reservations",samples.reservations));expect(injected.sheet("Report Data").cell("A2").value()).toBe("'=CMD()");const empty=await XlsxPopulate.fromDataAsync(await toXlsx("inventory",[]));expect(empty.sheet("Report Data").cell("A2").value()).toContain("No records");});
  it.each(Object.keys(samples) as ReportType[])("creates a paginated %s PDF with vector graphics",async type=>{const data=await toPdf(type,samples[type]);expect(data.subarray(0,5).toString()).toBe("%PDF-");expect(data.length).toBeGreaterThan(1500);expect(data.toString("latin1")).toContain("/Type /Page");});
});
