import { createHash } from "crypto";
import { normalize } from "./format";
export const calculateAmount=(unitPrice:number,liters:number)=>Math.round((unitPrice*liters+Number.EPSILON)*100)/100;
export const excelDateToDate=(serial:number)=>new Date(Date.UTC(1899,11,30)+serial*86400000);
export const semiMonthlyPeriod=(date:Date)=>date.getUTCDate()<=15?"1-15":"16-end";
export const fingerprint=(row:{date:string;po?:string;company?:string;vehicle?:string;unitPrice:number;liters:number})=>createHash("sha256").update([row.date,normalize(row.po??""),normalize(row.company??""),normalize(row.vehicle??""),row.unitPrice.toFixed(4),row.liters.toFixed(3)].join("|")).digest("hex");
export const isDetailSheet=(name:string)=>/^(Jan|Feb|Mar|Apr|May|June|July|Aug|Sep|Oct|Nov|Dec)\s+(1-15|16-(28|29|30|31))$/i.test(name.trim());
