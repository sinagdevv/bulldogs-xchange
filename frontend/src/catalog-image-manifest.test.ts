import {describe,expect,it} from "vitest";
import {catalogImageManifest} from "./catalog-image-manifest";
import {catalogImageForSku,productImage} from "./product-images";

describe("official catalog image manifest",()=>{
  it("covers each reviewed CSV product without substituting missing photographs",()=>{
    expect(Object.keys(catalogImageManifest)).toEqual(["SHS-POLO-M","SHS-PANTS-M","SHS-BLSE-F","SHS-PANTS-F","COL-POLO-M","COL-PANTS-M","COL-BLSE-F","COL-PANTS-F","COL-PANTS-W","PE-SHIRT","PE-JOG","NSTP-SHIRT","MRC-SHIRT","MRC-TOTE","MRC-CAP","MRC-SWEAT","MRC-VARSITY","MRC-LFAN","MRC-HFAN"]);
    expect(catalogImageManifest["COL-PANTS-W"]).toMatchObject({status:"missing"});
    expect(catalogImageManifest["MRC-SWEAT"]).toMatchObject({status:"missing"});
    expect(catalogImageForSku("NSTP-SHIRT")).toBe("/merch/others-nstp-shirt-cutout.png");
    expect(catalogImageForSku("MRC-VARSITY")).toBe("/merch/others-mer-jacket.webp");
  });
  it("uses stored production URLs before the reviewed local fallback",()=>{
    expect(productImage({id:"1",title:"PE Shirt",categoryId:"3",sku:"PE-SHIRT",description:"",price:300,isFeatured:false,isActive:true})).toBe("/merch/others-pe-shirt.webp");
    expect(productImage({id:"1",title:"PE Shirt",categoryId:"3",sku:"PE-SHIRT",description:"",price:300,imageUrl:"https://cdn.example.test/pe.png",isFeatured:false,isActive:true})).toBe("https://cdn.example.test/pe.png");
  });
});
