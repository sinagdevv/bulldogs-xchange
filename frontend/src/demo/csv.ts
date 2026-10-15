/** Minimal CSV writer. No dependency, RFC 4180 quoting, and spreadsheet formula injection protection. */
export type Cell=string|number|boolean|null|undefined;

/** Text cells that a spreadsheet could read as a formula are prefixed with an apostrophe. Real numbers are left alone. */
export function csvCell(value:Cell):string{
  if(value===null||value===undefined)return "";
  if(typeof value==="number")return Number.isFinite(value)?String(value):"";
  if(typeof value==="boolean")return value?"TRUE":"FALSE";
  let t=value;
  if(/^[=+\-@\t\r]/.test(t))t=`'${t}`;
  return /[",\r\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t;
}
export function toCsv(headers:string[],rows:Cell[][]):string{
  return [headers,...rows].map(r=>r.map(csvCell).join(",")).join("\r\n")+"\r\n";
}
/** Browser download. A UTF-8 byte order mark makes Excel read the peso sign correctly. */
export function downloadCsv(filename:string,csv:string){
  const url=URL.createObjectURL(new Blob(["﻿",csv],{type:"text/csv;charset=utf-8"})),a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
