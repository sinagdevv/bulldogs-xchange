import PDFDocument from "pdfkit";
import JSZip from "jszip";
import XLSXChart from "xlsx-chart";
import XlsxPopulate from "xlsx-populate";

export type ReportType="reservations"|"product-movement"|"inventory"|"pickups";
type Row=Record<string,unknown>;
type Chart={type:"column"|"line";title:string;series:Record<string,Record<string,number>>;fields:string[]};

const names:Record<ReportType,string>={reservations:"Reservations", "product-movement":"Product Movement",inventory:"Inventory Summary",pickups:"Pickup Activity"};
const number=(value:unknown)=>Number(value)||0;
const text=(value:unknown)=>value instanceof Date?value.toISOString():String(value??"");
const safeCell=(header:string,value:unknown)=>typeof value==="string"&&/^[=+\-@]/.test(value)?`'${value}`:/(?:at|date)$/i.test(header)&&value?new Date(String(value)):value;
const label=(key:string)=>key.replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./,value=>value.toUpperCase());
const readable=(header:string,value:unknown)=>/(?:at|date)$/i.test(header)&&value?(value instanceof Date?value:new Date(String(value))).toLocaleString("en-PH",{timeZone:"UTC",year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",hour12:false}):text(value);
const key=(value:unknown)=>text(value).slice(0,40)||"Unknown";

function summarize(type:ReportType,rows:Row[]){
  if(type==="reservations")return[["Reservations",rows.length],["Completed pickups",rows.filter(row=>row.status==="Completed").length],["Active",rows.filter(row=>!["Completed","Cancelled","Expired"].includes(text(row.status))).length]] as [string,number][];
  if(type==="product-movement")return[["Products / variants",rows.length],["Units reserved",rows.reduce((sum,row)=>sum+number(row.unitsReserved),0)],["Units picked up",rows.reduce((sum,row)=>sum+number(row.unitsPickedUp),0)]] as [string,number][];
  if(type==="inventory")return[["Products / variants",rows.length],["Physical units",rows.reduce((sum,row)=>sum+number(row.physicalQuantity),0)],["Available units",rows.reduce((sum,row)=>sum+number(row.availableQuantity),0)]] as [string,number][];
  return[["Completed pickups",rows.length],["Recorded sales",rows.reduce((sum,row)=>sum+number(row.recordedAmount),0)],["Payment methods",new Set(rows.map(row=>row.paymentMethod).filter(Boolean)).size]] as [string,number][];
}

function chart(type:ReportType,rows:Row[]):Chart{
  if(type==="reservations"){const counts:Record<string,number>={};for(const row of rows)counts[key(row.status)]=(counts[key(row.status)]??0)+1;const fields=Object.keys(counts);return{type:"column",title:"Reservations by status",fields:fields.length?fields:["No data"],series:{Reservations:fields.length?counts:{"No data":0}}};}
  if(type==="product-movement"){const picked:Record<string,number>={},reserved:Record<string,number>={};for(const row of rows.slice(0,20)){const name=key(`${text(row.product)} ${text(row.variant)}`);reserved[name]=number(row.unitsReserved);picked[name]=number(row.unitsPickedUp);}const fields=Object.keys(reserved);return{type:"column",title:"Merchandise movement",fields:fields.length?fields:["No data"],series:{"Units reserved":fields.length?reserved:{"No data":0},"Units picked up":fields.length?picked:{"No data":0}}};}
  if(type==="inventory"){const available:Record<string,number>={},physical:Record<string,number>={},reorder:Record<string,number>={};for(const row of rows.slice(0,20)){const name=key(`${text(row.product)} ${text(row.variant)}`);physical[name]=number(row.physicalQuantity);available[name]=number(row.availableQuantity);reorder[name]=number(row.reorderLevel);}const fields=Object.keys(physical);return{type:"column",title:"Inventory levels",fields:fields.length?fields:["No data"],series:{Physical:fields.length?physical:{"No data":0},Available:fields.length?available:{"No data":0},"Reorder level":fields.length?reorder:{"No data":0}}};}
  const counts:Record<string,number>={};for(const row of rows){const day=text(row.completedAt).slice(0,10)||"Unknown";counts[day]=(counts[day]??0)+1;}const fields=Object.keys(counts).sort();return{type:"line",title:"Completed pickups by date",fields:fields.length?fields:["No data"],series:{Pickups:fields.length?counts:{"No data":0}}};
}

const rangeText=(query:Record<string,string|string[]|undefined>)=>`${text(query.startDate)||"Beginning"} – ${text(query.endDate)||"Today"} (inclusive UTC)`;
const chartBuffer=(value:Chart)=>new Promise<Buffer>((resolve,reject)=>new XLSXChart().generate({chart:value.type,titles:Object.keys(value.series),fields:value.fields,data:value.series,chartTitle:value.title},(error:Error|null,data:Buffer)=>error?reject(error):resolve(data)));

export async function toXlsx(type:ReportType,rows:Row[],query:Record<string,string|string[]|undefined>={}):Promise<Buffer>{
  const visual=chart(type,rows),workbook=await XlsxPopulate.fromDataAsync(await chartBuffer(visual)),summary=workbook.sheet(0),data=workbook.addSheet("Report Data");
  summary.name("Dashboard");summary.cell("A1").value(`${names[type]} — ${visual.title}`);summary.cell("A2").value(rangeText(query));
  const kpis=summarize(type,rows);kpis.forEach(([name,value],index)=>{summary.cell(index+4,1).value(name).style({bold:true,fontColor:"7A0019"});summary.cell(index+4,2).value(value).style({bold:true,numberFormat:type==="pickups"&&name==="Recorded sales"?'₱#,##0.00':'0'});});
  const headers=rows.length?Object.keys(rows[0]!):["message"];data.cell(1,1).value([headers.map(label)]);if(rows.length)data.cell(2,1).value(rows.map(row=>headers.map(header=>safeCell(header,row[header]))));else data.cell(2,1).value("No records matched the selected date range.");
  data.range(1,1,1,headers.length).style({bold:true,fontColor:"FFFFFF",fill:"7A0019",horizontalAlignment:"center"}).autoFilter();data.freezePanes("A2");
  headers.forEach((header,index)=>{const values=rows.slice(0,100).map(row=>text(row[header]).length);data.column(index+1).width(Math.min(42,Math.max(12,label(header).length+2,...values)));if(/(?:amount|price)$/i.test(header))data.range(2,index+1,Math.max(2,rows.length+1),index+1).style("numberFormat",'₱#,##0.00');if(/(?:at|date)$/i.test(header))data.range(2,index+1,Math.max(2,rows.length+1),index+1).style("numberFormat","yyyy-mm-dd hh:mm");});
  const zip=await JSZip.loadAsync(Buffer.from(await workbook.outputAsync()));for(const name of Object.keys(zip.files).filter(name=>/^xl\/charts\/chart\d+\.xml$/.test(name))){const file=zip.file(name);if(file)zip.file(name,(await file.async("string")).replaceAll("Table!","Dashboard!"));}return zip.generateAsync({type:"nodebuffer"});
}

function drawChart(doc:PDFKit.PDFDocument,value:Chart){
  const x=48,y=doc.y+12,width=499,height=145,all=Object.values(value.series).flatMap(series=>value.fields.map(field=>series[field]??0)),max=Math.max(1,...all),series=Object.entries(value.series),slot=width/Math.max(1,value.fields.length),bar=Math.max(3,(slot-8)/series.length),palette=["#0B1F3A","#D4AF37","#6B7280"];
  doc.fontSize(13).fillColor("#0B1F3A").text(value.title).moveDown(.35);doc.strokeColor("#9CA3AF").moveTo(x,y+height).lineTo(x+width,y+height).stroke();
  value.fields.forEach((field,i)=>{series.forEach(([,values],j)=>{const amount=values[field]??0,h=amount/max*(height-28);doc.fillColor(palette[j%3]!).rect(x+i*slot+4+j*bar,y+height-h,bar-1,h).fill();doc.fontSize(8).fillColor("#1F2937").text(String(amount),x+i*slot+4+j*bar-4,y+height-h-11,{width:bar+8,align:"center"});});doc.save().translate(x+i*slot+slot/2,y+height+5).rotate(25).fontSize(8).fillColor("#374151").text(field.slice(0,18),0,0,{width:Math.max(55,slot+20)}).restore();});
  doc.y=y+height+42;series.forEach(([name],i)=>{doc.fillColor(palette[i%3]!).rect(x+i*165,doc.y,8,8).fill().fillColor("#374151").fontSize(8).text(name,x+12+i*165,doc.y-1,{width:145});});doc.moveDown(1.5);
}

export async function toPdf(type:ReportType,rows:Row[],query:Record<string,string|string[]|undefined>={}):Promise<Buffer>{
  const doc=new PDFDocument({size:"A4",margin:40,bufferPages:true,info:{Title:`Bulldogs Xchange — ${names[type]}`}}),chunks:Buffer[]=[];doc.on("data",chunk=>chunks.push(chunk));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject);});
  doc.fillColor("#0B1F3A").fontSize(22).text("NU BULLDOGS XCHANGE").fontSize(17).text(names[type]);doc.fillColor("#4B5563").fontSize(9).text(rangeText(query)).moveDown(.7);
  const kpis=summarize(type,rows),kpiY=doc.y;kpis.forEach(([name,value],i)=>{const x=40+i*175;doc.roundedRect(x,kpiY,160,45,4).fill("#F7F3E8").fillColor("#0B1F3A").fontSize(9).text(name,x+8,kpiY+7,{width:144}).fontSize(15).text(type==="pickups"&&name==="Recorded sales"?`₱${value.toLocaleString(undefined,{minimumFractionDigits:2})}`:String(value),x+8,kpiY+21,{width:144});});doc.y=kpiY+56;drawChart(doc,chart(type,rows));
  doc.fillColor("#0B1F3A").fontSize(14).text("Detailed data").moveDown(.35);const headers=rows.length?Object.keys(rows[0]!):["message"],width=(doc.page.width-80)/headers.length,headerHeight=22;
  const header=()=>{const y=doc.y;headers.forEach((name,i)=>doc.rect(40+i*width,y,width,headerHeight).fill("#0B1F3A").fillColor("#FFF").fontSize(7).text(label(name),44+i*width,y+7,{width:width-8}));doc.y=y+headerHeight;};header();
  const output=rows.length?rows:[{message:"No records matched the selected date range."}];let pageRows=0;for(const row of output){const values=headers.map(name=>readable(name,row[name])),rowHeight=Math.max(20,...values.map(value=>doc.fontSize(7).heightOfString(value,{width:width-8})+8));if(pageRows===22||doc.y+rowHeight>doc.page.height-58){doc.addPage();header();pageRows=0;}const y=doc.y;headers.forEach((name,i)=>doc.rect(40+i*width,y,width,rowHeight).stroke("#D1D5DB").fillColor("#1F2937").fontSize(7).text(values[i]!,44+i*width,y+5,{width:width-8,height:rowHeight-7,ellipsis:true}));doc.y=y+rowHeight;pageRows++;}
  const pages=doc.bufferedPageRange();for(let i=0;i<pages.count;i++){doc.switchToPage(i);doc.fillColor("#777").fontSize(8).text(`Bulldogs Xchange • Page ${i+1} of ${pages.count}`,40,doc.page.height-55,{align:"center",width:doc.page.width-80,lineBreak:false});}doc.end();return done;
}
