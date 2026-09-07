import {cache} from "react";
import {db} from "@/lib/db";

// A locked month is a closed accounting period: no transaction dated inside it may be
// created, edited or removed until an administrator reopens it. Locks live in AppSetting
// rather than their own table, so no schema change is needed to deploy this.
export type MonthLock={month:string;lockedAt:string;lockedByName:string};

export const monthLockKey=(organizationId:string)=>`transactions.monthLocks:${organizationId}`;
export const monthOf=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
export const isMonth=(value:string)=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value);
export const monthLabel=(month:string)=>{
  const [year,index]=month.split("-").map(Number);
  return new Date(year,index-1,1).toLocaleDateString("en-PH",{month:"long",year:"numeric"});
};

export const getMonthLocks=cache(async(organizationId:string):Promise<MonthLock[]>=>{
  const row=await db.appSetting.findUnique({where:{key:monthLockKey(organizationId)}});
  const value=row?.value;
  if(!Array.isArray(value))return [];
  return value
    .filter((item):item is MonthLock=>
      typeof item==="object"&&item!==null&&
      typeof (item as MonthLock).month==="string"&&isMonth((item as MonthLock).month))
    .sort((a,b)=>b.month.localeCompare(a.month));
});

export async function lockedMonthSet(organizationId:string):Promise<Set<string>>{
  return new Set((await getMonthLocks(organizationId)).map(lock=>lock.month));
}

// Returns an error message when the date falls in a closed period, or null when it is free.
export async function monthLockError(organizationId:string,...dates:(Date|null|undefined)[]):Promise<string|null>{
  const locked=await lockedMonthSet(organizationId);
  for(const date of dates){
    if(!date)continue;
    const month=monthOf(date);
    if(locked.has(month))return `${monthLabel(month)} is locked. An administrator must unlock the month before it can be changed.`;
  }
  return null;
}
