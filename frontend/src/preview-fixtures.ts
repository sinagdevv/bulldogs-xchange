/**
 * Presentation-only sample data for the development design preview.
 * Never sent to or read from the backend, never written to Supabase.
 */
import type {Product,ReservationStatus} from "./types";

export const pvCategories=["Shirts","Hoodies","Jackets","Uniforms","Accessories"] as const;
const p=(n:number,title:string,categoryId:string,price:number,featured=false):Product=>({id:`p${n}`,title,categoryId,sku:`SAMPLE-${String(n).padStart(3,"0")}`,description:"Sample product shown for design review. Real merchandise and photos replace this later.",price,isFeatured:featured,isActive:true});
export const pvProducts:Product[]=[p(1,"Sample Tee","Shirts",350,true),p(2,"Sample Hoodie","Hoodies",950,true),p(3,"Sample Jacket","Jackets",1450),p(4,"Sample Uniform Polo","Uniforms",520),p(5,"Sample Cap","Accessories",300,true),p(6,"Sample Tote","Accessories",280),p(7,"Sample Long Sleeve","Shirts",480),p(8,"Sample Zip Hoodie","Hoodies",1100)];
export const pvVariants:{name:string;stock:number}[]=[{name:"Small",stock:9},{name:"Medium",stock:2},{name:"Large",stock:6},{name:"XL",stock:0}];

export type PvStudent={id:string;name:string;registered:string;status:"pending"|"approved"|"rejected"|"suspended";reason?:string};
export const pvStudents:PvStudent[]=[
  {id:"2026-100001",name:"Ana Reyes",registered:"Oct 8, 2026",status:"pending"},
  {id:"2026-100002",name:"Marco Santos",registered:"Oct 8, 2026",status:"pending"},
  {id:"2026-100003",name:"Lia Mendoza",registered:"Oct 7, 2026",status:"pending"},
  {id:"2026-100004",name:"Paolo Dizon",registered:"Oct 6, 2026",status:"approved"},
  {id:"2026-100005",name:"Kyla Navarro",registered:"Oct 6, 2026",status:"approved"},
  {id:"2026-100006",name:"Joaquin Bautista",registered:"Oct 5, 2026",status:"rejected",reason:"Student ID does not match school records."},
  {id:"2026-100007",name:"Trisha Valdez",registered:"Oct 4, 2026",status:"suspended"},
  {id:"2026-100008",name:"Miguel Ocampo",registered:"Oct 3, 2026",status:"approved"},
];
export type PvReservation={ref:string;student:string;items:string;status:ReservationStatus};
export const pvReservations:PvReservation[]=[
  {ref:"BX-SAMPLE-0001",student:"Paolo Dizon",items:"Sample Tee (M) x1",status:"Pending"},
  {ref:"BX-SAMPLE-0002",student:"Kyla Navarro",items:"Sample Hoodie (L) x1",status:"Confirmed"},
  {ref:"BX-SAMPLE-0003",student:"Miguel Ocampo",items:"Sample Cap x2",status:"Preparing"},
  {ref:"BX-SAMPLE-0004",student:"Ana Reyes",items:"Sample Tote x1",status:"Ready for Pickup"},
  {ref:"BX-SAMPLE-0005",student:"Lia Mendoza",items:"Sample Jacket (S) x1",status:"Pending"},
];
export const pvInventory=[
  {product:"Sample Tee",variant:"Small",physical:12,reserved:3,reorder:4},
  {product:"Sample Tee",variant:"Medium",physical:6,reserved:5,reorder:3},
  {product:"Sample Hoodie",variant:"Large",physical:8,reserved:1,reorder:3},
  {product:"Sample Cap",variant:"Standard",physical:2,reserved:2,reorder:2},
  {product:"Sample Tote",variant:"Standard",physical:10,reserved:0,reorder:3},
];
