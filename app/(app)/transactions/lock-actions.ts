"use server";
import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {getMonthLocks,isMonth,monthLabel,monthLockKey,type MonthLock} from "@/lib/month-locks";
import {revalidatePath} from "next/cache";

// Closing a month is routine, so staff may do it. Reopening one undoes a control, so it is
// kept to administrators -- which is also the only way to edit anything inside a closed month.
export async function setMonthLock(month:string,locked:boolean){
  const session=await requireSession(locked?["ADMINISTRATOR","STAFF"]:["ADMINISTRATOR"]);
  if(!isMonth(month))return{ok:false,error:"Choose a month in YYYY-MM form"};
  const current=await getMonthLocks(session.organizationId);
  const already=current.some(lock=>lock.month===month);
  if(locked===already)return{ok:true,error:""};
  const next:MonthLock[]=locked
    ?[...current,{month,lockedAt:new Date().toISOString(),lockedByName:session.name}]
    :current.filter(lock=>lock.month!==month);
  const key=monthLockKey(session.organizationId);
  await db.$transaction([
    db.appSetting.upsert({where:{key},create:{key,value:next},update:{value:next}}),
    db.auditLog.create({data:{
      userId:session.userId,action:locked?"LOCK_MONTH":"UNLOCK_MONTH",
      entityType:"FuelTransaction",entityId:month,
      afterValue:{month,label:monthLabel(month),locked},
    }}),
  ]);
  for(const path of ["/transactions","/transactions/new","/dashboard","/reports"])revalidatePath(path);
  return{ok:true,error:""};
}
