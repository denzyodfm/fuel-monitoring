"use server";
import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {isMonth,monthLabel} from "@/lib/month-locks";
import {getMonthNotes,MONTH_NOTE_MAX,monthNoteKey,type MonthNote} from "@/lib/month-notes";
import {revalidatePath} from "next/cache";

// A note is commentary on a period, not a control over it, so staff may write one even
// after the month is locked. Clearing the text removes the note.
export async function setMonthNote(month:string,note:string){
  const session=await requireSession(["ADMINISTRATOR","STAFF"]);
  if(!isMonth(month))return{ok:false,error:"Choose a month in YYYY-MM form"};
  const text=note.trim();
  if(text.length>MONTH_NOTE_MAX)return{ok:false,error:`Keep the note under ${MONTH_NOTE_MAX} characters`};
  const current=await getMonthNotes(session.organizationId);
  const rest=current.filter(item=>item.month!==month);
  const next:MonthNote[]=text
    ?[...rest,{month,note:text,updatedAt:new Date().toISOString(),updatedByName:session.name}]
    :rest;
  const key=monthNoteKey(session.organizationId);
  await db.$transaction([
    db.appSetting.upsert({where:{key},create:{key,value:next},update:{value:next}}),
    db.auditLog.create({data:{
      userId:session.userId,action:text?"SET_MONTH_NOTE":"CLEAR_MONTH_NOTE",
      entityType:"FuelTransaction",entityId:month,
      afterValue:{month,label:monthLabel(month),note:text},
    }}),
  ]);
  revalidatePath("/reports");
  return{ok:true,error:""};
}
