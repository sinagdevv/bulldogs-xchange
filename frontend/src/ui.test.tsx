import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it} from "vitest";
import {ApprovalView,ProductCard,StatusBadge} from "./components";
import {formatPeso,reservationFlow,statusTone} from "./format";
import type {Product} from "./types";

const product:Product={id:"9",title:"Bulldogs Hoodie",categoryId:"1",sku:"BX-HOOD",description:"Fleece hoodie.",price:1250,isFeatured:true,isActive:true};
describe("design system primitives",()=>{
  it("maps statuses to consistent tones",()=>{expect(statusTone("Ready for Pickup")).toBe("success");expect(statusTone("Pending")).toBe("warning");expect(statusTone("rejected")).toBe("danger");expect(statusTone("Unknown")).toBe("neutral");expect(renderToStaticMarkup(<StatusBadge value="Cancelled"/>)).toContain('class="badge danger"')});
  it("formats prices in pesos and keeps the reservation flow order",()=>{expect(formatPeso(1250)).toMatch(/1,250/);expect(reservationFlow).toEqual(["Pending","Confirmed","Preparing","Ready for Pickup","Completed"])});
  it("does not map an unapproved SKU to a product image",()=>{const html=renderToStaticMarkup(<MemoryRouter><ProductCard product={product}/></MemoryRouter>);expect(html).toContain("image coming soon");expect(html).toContain('href="/shop/9"');expect(html).not.toContain('src="/images/products/approved')});
it("uses the reviewed image mapping for a known catalog SKU",()=>{const html=renderToStaticMarkup(<MemoryRouter><ProductCard product={{...product,sku:"BX-CAP"}}/></MemoryRouter>);expect(html).toContain('src="/images/products/approved/MER-CAP-001-FRONT.webp"')});
  it("does not trust an unverified catalog image URL",()=>{const html=renderToStaticMarkup(<MemoryRouter><ProductCard product={{...product,imageUrl:"/images/hoodie.jpg"}}/></MemoryRouter>);expect(html).not.toContain('src="/images/hoodie.jpg"')});
  it("explains why approval is required and shows rejection reasons",()=>{const view=(node:React.ReactNode)=>renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);expect(view(<ApprovalView status="pending" justRegistered/>)).toContain("Admin identity check");expect(view(<ApprovalView status="rejected" reason="ID mismatch"/>)).toContain("ID mismatch");expect(view(<ApprovalView status="suspended"/>)).toContain("Account suspended")});
});
