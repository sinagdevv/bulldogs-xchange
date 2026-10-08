import type {Reservation} from "./types";

export const reservationValidation=(quantity:number,available:number)=>!Number.isInteger(quantity)||quantity<1?"Enter a whole quantity of at least 1.":quantity>available?`Only ${available} available.`:null;
export const belongsToCustomer=(reservation:Reservation,email:string)=>reservation.customerEmail.toLowerCase()===email.toLowerCase();
export const viewState=(loading:boolean,error:string,count:number)=>error?"error":loading?"loading":count?"content":"empty";
