"use server";
import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {mergeVehiclesInTransaction} from "@/lib/merge-vehicles";
import {revalidatePath} from "next/cache";

// Merging keeps one vehicle and moves everything attached to the others onto it, then removes
// the emptied records. Nothing is deleted except the duplicate vehicle rows themselves --
// transactions, odometer logs, assignments and policies are repointed, never dropped.
export async function mergeVehicles(survivorId:string,duplicateIds:string[],confirmation:string){
  const session=await requireSession(["ADMINISTRATOR"]);
  if(confirmation!=="MERGE")return{ok:false,error:"Type MERGE exactly to confirm"};
  const ids=[...new Set(duplicateIds)].filter(id=>id&&id!==survivorId);
  if(!survivorId)return{ok:false,error:"Choose which record to keep"};
  if(!ids.length)return{ok:false,error:"Select at least one other record to merge into it"};
  try{
    const moved=await db.$transaction(tx=>mergeVehiclesInTransaction(tx,{
      organizationId:session.organizationId,userId:session.userId,survivorId,duplicateIds:ids,
    }));
    for(const path of ["/vehicles","/transactions","/dashboard","/insurance","/reports"])revalidatePath(path);
    return{ok:true,error:"",moved};
  }catch{
    return{ok:false,error:"The merge could not be completed, so nothing was changed. Reload and try again."};
  }
}
