import {cache} from "react";
import {db} from "@/lib/db";
import {isMonth} from "@/lib/month-locks";

// A month note is free text about an accounting period -- why a month ran high, what a
// reimbursement covered -- shown on the monthly report. Like month locks it lives in
// AppSetting rather than its own table, so no schema change is needed to deploy this.
export type MonthNote={month:string;note:string;updatedAt:string;updatedByName:string};

export const MONTH_NOTE_MAX=1000;
export const monthNoteKey=(organizationId:string)=>`reports.monthNotes:${organizationId}`;

export const getMonthNotes=cache(async(organizationId:string):Promise<MonthNote[]>=>{
  const row=await db.appSetting.findUnique({where:{key:monthNoteKey(organizationId)}});
  const value=row?.value;
  if(!Array.isArray(value))return [];
  return value
    .filter((item):item is MonthNote=>
      typeof item==="object"&&item!==null&&
      typeof (item as MonthNote).month==="string"&&isMonth((item as MonthNote).month)&&
      typeof (item as MonthNote).note==="string")
    .sort((a,b)=>b.month.localeCompare(a.month));
});

export async function monthNoteMap(organizationId:string):Promise<Map<string,MonthNote>>{
  return new Map((await getMonthNotes(organizationId)).map(note=>[note.month,note]));
}
