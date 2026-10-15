export const SHOWCASE_CATEGORIES=["Tourism Management","Hospitality Management","Psychology","Traditional College Uniforms","Senior High School","General Merchandise"] as const;
export const SHOWCASE_TYPES=["Uniforms","Vests","Blazers","Pants","Shirts","Caps","Bags","Accessories"] as const;
export type ShowcaseCategory=typeof SHOWCASE_CATEGORIES[number];
export type ShowcaseType=typeof SHOWCASE_TYPES[number];

const files=SHOWCASE_ASSETS;

const categoryOf=(file:string):ShowcaseCategory=>file.startsWith("college-tm-")?"Tourism Management":file.startsWith("college-hm-")?"Hospitality Management":file.startsWith("college-psych-")?"Psychology":file.startsWith("college-trad-")?"Traditional College Uniforms":file.startsWith("shs-")?"Senior High School":"General Merchandise";
const typeOf=(file:string):ShowcaseType=>file.includes("vest")?"Vests":file.includes("blazer")||file.includes("coat")||file.includes("jacket")?"Blazers":file.includes("pants")?"Pants":file.includes("top")||file.includes("shirt")||file.includes("sweatshirt")?"Shirts":file.includes("cap")?"Caps":file.includes("tote")?"Bags":file.includes("scarf")||file.includes("fan")||file.includes("cup")?"Accessories":"Uniforms";
const titleOf=(file:string)=>file.replace(/\.webp$/,"").replace(/^(college-(hm|tm|psych|trad)-col-(hm|tm|psych|trad)-|shs-shs-trad-|others-)/,"").split("-").map(s=>({f:"Female",m:"Male",mer:"Merchandise",nu:"NU",pe:"PE",nstp:"NSTP"}[s]??`${s[0]!.toUpperCase()}${s.slice(1)}`)).join(" ");

/** Photos whose background could not be removed without erasing white fabric; shown full-bleed as studio photos. */
const STUDIO_PHOTOS=new Set(["MER-TSH-003-FRONT.webp"]);

export const showcaseItems=files.map(({source,src,approved})=>{const file=source.replace(/^assets\//,"").replace(/\.[^.]+$/,"").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".webp";return {file:src.split("/").at(-1)!,src,title:titleOf(file),category:categoryOf(file),type:typeOf(file),approved,studio:STUDIO_PHOTOS.has(src.split("/").at(-1)!)}});
import {SHOWCASE_ASSETS} from "./showcase-assets";

