export type CatalogImageStatus="verified-local"|"missing";
export type CatalogImage={asset?:string;status:CatalogImageStatus;source:string};

// Only exact, locally verified SKU photographs belong here. Similar garments stay missing.
export const catalogImageManifest:Record<string,CatalogImage>={
  "SHS-POLO-M":{asset:"/merch/shs-shs-trad-top-m.webp",status:"verified-local",source:"assets/SHS/SHS_Trad_Top_M.png"},
  "SHS-PANTS-M":{asset:"/merch/shs-shs-trad-pants-m.webp",status:"verified-local",source:"assets/SHS/SHS_Trad_Pants_M.png"},
  "SHS-BLSE-F":{asset:"/merch/shs-shs-trad-top-f.webp",status:"verified-local",source:"assets/SHS/SHS_Trad_Top_F.png"},
  "SHS-PANTS-F":{asset:"/merch/shs-shs-trad-pants-f.webp",status:"verified-local",source:"assets/SHS/SHS_Trad_Pants_F.png"},
  "COL-POLO-M":{asset:"/merch/college-trad-col-trad-top-m.webp",status:"verified-local",source:"assets/College/College_Trad_Top_M.png"},
  "COL-PANTS-M":{asset:"/merch/college-trad-col-trad-pants-m.webp",status:"verified-local",source:"assets/College/College_Trad_Pants_M.png"},
  "COL-BLSE-F":{asset:"/merch/college-trad-col-trad-top-f.webp",status:"verified-local",source:"assets/College/College_Trad_Top_F.png"},
  "COL-PANTS-F":{asset:"/merch/college-trad-col-trad-pants-f.webp",status:"verified-local",source:"assets/College/College_Trad_Pants_F.png"},
  "COL-PANTS-W":{status:"missing",source:"No exact College women's-pants photograph supplied"},
  "PE-SHIRT":{asset:"/merch/others-pe-shirt.webp",status:"verified-local",source:"assets/OTHERS/PE_SHIRT.png"},
  "PE-JOG":{asset:"/merch/others-pe-pants.webp",status:"verified-local",source:"assets/OTHERS/PE_PANTS.png"},
  "NSTP-SHIRT":{asset:"/merch/others-nstp-shirt.webp",status:"verified-local",source:"assets/OTHERS/NSTP_SHIRT.png"},
  "MRC-SHIRT":{asset:"/merch/others-mer-shirt.webp",status:"verified-local",source:"assets/OTHERS/MER_SHIRT.png"},
  "MRC-TOTE":{asset:"/merch/others-mer-tote.webp",status:"verified-local",source:"assets/OTHERS/MER_TOTE.png"},
  "MRC-CAP":{asset:"/merch/others-mer-cap.webp",status:"verified-local",source:"assets/OTHERS/MER_CAP.png"},
  "MRC-SWEAT":{status:"missing",source:"No exact MRC sweatshirt photograph supplied"},
  "MRC-VARSITY":{asset:"/merch/others-mer-jacket.webp",status:"verified-local",source:"assets/OTHERS/MER_JACKET.png"},
  "MRC-LFAN":{asset:"/merch/others-mer-ledfan.webp",status:"verified-local",source:"assets/OTHERS/MER_LEDFAN.png"},
  "MRC-HFAN":{asset:"/merch/others-mer-handyfan.webp",status:"verified-local",source:"assets/OTHERS/MER_HANDYFAN.png"},
};
