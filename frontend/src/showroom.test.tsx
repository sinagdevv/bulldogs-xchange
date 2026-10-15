import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {describe,expect,it} from "vitest";
import {catalogImageForSku} from "./product-images";
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
  it("marks only the three live SKUs with a seal, using their catalog images",()=>{
    const rack=render(<ApparelRack/>),cab=render(<AccessoriesCabinet/>);
    expect((rack+cab).match(/class="sr-seal"/g)).toHaveLength(3);
    for(const sku of ["BX-SHIRT","BX-CAP","BX-TOTE"])expect(rack+cab).toContain(catalogImageForSku(sku));
  });
  it("gives a collection piece no shop action, and a live piece exactly one",()=>{
    const feature=render(<FocusPanel piece={{id:"t",name:"Crest Tumbler",line:"Drinkware",src:"/x.webp",approved:false,note:"Navy tumbler."}}/>);
    expect(feature).toContain("Collection feature");expect(feature).not.toContain("<a ");expect(feature).not.toMatch(/reserve/i);
    const liveHtml=render(<FocusPanel piece={{id:"s",name:"Bulldogs Shirt",line:"Official campus tee",src:catalogImageForSku("BX-SHIRT")!,approved:true,note:"Live."}}/>);
    expect(liveHtml.match(/<a /g)).toHaveLength(1);expect(liveHtml).toContain('href="/catalog"');expect(liveHtml).toContain("Available to reserve");
  });
});
