import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it} from "vitest";
import {AccessoriesCabinet,ApparelRack,FocusPanel,ShowroomHero} from "./showroom";

const render=(node:React.ReactNode)=>renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe("Bulldogs Showroom catalog boundary",()=>{
  it("never shows a price, stock count or reservation route",()=>{
    const html=render(<><ShowroomHero/><ApparelRack/><AccessoriesCabinet/></>);
    expect(html).not.toMatch(/₱|PHP\s?\d|in stock|out of stock|\/shop\/|reserve now/i);
  });
  it("uses no internal or placeholder wording in public copy",()=>{
    const text=render(<><ShowroomHero/><ApparelRack/><AccessoriesCabinet/></>).replace(/<[^>]*>/g," ");
    expect(text).not.toMatch(/showcase|promotional image|not available to reserve|synthetic|demo|placeholder|in the catalog/i);
  });
  it("marks only the three official live SKUs with a seal, using the original showroom art",()=>{
    const rack=render(<ApparelRack/>),cab=render(<AccessoriesCabinet/>);
    expect((rack+cab).match(/class="sr-seal"/g)).toHaveLength(3);
    for(const image of ["MER-TSH-001-FRONT.webp","MER-CAP-001-FRONT.webp","MER-TOTE-001-FRONT.webp"])expect(rack+cab).toContain(image);
    expect(rack+cab).toContain("NU Bulldogs Shirt");expect(rack+cab).toContain("NU Bulldogs Cap");expect(rack+cab).toContain("NU Bulldogs Tote");
  });
  it("gives a collection piece no shop action, and a live piece exactly one",()=>{
    const feature=render(<FocusPanel piece={{id:"t",name:"Crest Tumbler",line:"Drinkware",src:"/x.webp",approved:false,note:"Navy tumbler."}}/>);
    expect(feature).toContain("Collection feature");expect(feature).not.toContain("<a ");expect(feature).not.toMatch(/reserve/i);
    const liveHtml=render(<FocusPanel piece={{id:"s",name:"NU Bulldogs Shirt",line:"Official campus tee",src:"/images/products/approved/MER-TSH-001-FRONT.webp",approved:true,note:"Live."}}/>);
    expect(liveHtml.match(/<a /g)).toHaveLength(1);expect(liveHtml).toContain('href="/catalog"');expect(liveHtml).toContain("Available to reserve");
  });
  it("marks exactly one garment and one accessory as pressed by default, with a selection badge on every piece",()=>{
    const rack=render(<ApparelRack/>),cab=render(<AccessoriesCabinet/>);
    expect(rack.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(cab.match(/aria-pressed="true"/g)).toHaveLength(1);
    // Every piece renders the badge element (CSS, not a conditional class, controls visibility) --
    // this keeps the selected/unselected markup stable and lets CSS alone gate opacity.
    expect(rack.match(/class="sr-select-badge"/g)?.length).toBe(7);
    expect(cab.match(/class="sr-select-badge"/g)?.length).toBe(8);
  });
  it("selection badge never appears alongside reservation wording for a non-reservable piece",()=>{
    // A collection-only piece (approved:false) must never render the reservable seal or its
    // "Available to reserve" text in its own tag, regardless of selection state.
    const html=render(<ApparelRack/>);
    const jacketLi=html.match(/<li style="--i:0">.*?<\/li>/)?.[0];
    expect(jacketLi).toContain("Varsity Jacket");
    expect(jacketLi).not.toMatch(/sr-seal|Available to reserve/);
  });
});
