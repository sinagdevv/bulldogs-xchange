import {createHmac} from "node:crypto";
import {AppError} from "../lib/errors.js";

export const AUTH_ALIAS_DOMAIN="auth.bulldogs-xchange.invalid";
export function normalizeStudentId(value:string){const normalized=value.trim().toUpperCase().replace(/\s+/g,"");if(!/^[A-Z0-9-]{3,50}$/.test(normalized))throw new AppError("VALIDATION_ERROR","Enter a valid Student ID.");return normalized;}
export function studentIdAlias(studentId:string,secret=process.env.AUTH_IDENTITY_SECRET){if(!secret)throw new AppError("CONFIGURATION_ERROR","Student ID authentication is not configured.");return `${createHmac("sha256",secret).update(normalizeStudentId(studentId)).digest("hex")}@${AUTH_ALIAS_DOMAIN}`;}
export const isAuthAlias=(value:string)=>value.trim().toLowerCase().endsWith(`@${AUTH_ALIAS_DOMAIN}`);
