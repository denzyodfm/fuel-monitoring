"use server";
import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {normalize} from "@/lib/format";
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

  const vehicles=await db.vehicle.findMany({where:{id:{in:[survivorId,...ids]},organizationId:session.organizationId}});
  if(vehicles.length!==ids.length+1)return{ok:false,error:"One of those vehicles is no longer available. Reload and try again."};
  const survivor=vehicles.find(vehicle=>vehicle.id===survivorId)!;
  const duplicates=vehicles.filter(vehicle=>vehicle.id!==survivorId);

  try{
    const moved=await db.$transaction(async tx=>{
      // Record what moves, so the audit entry is enough to undo this by hand if needed.
      const movedTransactions=await tx.fuelTransaction.findMany({where:{vehicleId:{in:ids}},select:{id:true,vehicleId:true}});
      const existingAliases=await tx.vehicleAlias.findMany({where:{vehicleId:survivorId}});
      const taken=new Set(existingAliases.map(alias=>alias.normalized));

      // Excel import matches a vehicle on its plate, on "plate + asset name", and on its
      // aliases. Keep every spelling the duplicates answered to, or the next import would
      // fail to match and quietly recreate them.
      const carried=await tx.vehicleAlias.findMany({where:{vehicleId:{in:ids}}});
      const candidates=[
        ...duplicates.flatMap(vehicle=>{
          const plate=vehicle.plateNumber.trim(),asset=(vehicle.assetName??"").trim();
          // Many records repeat the plate in the asset name, so the combined form is only
          // worth keeping when the asset name actually says something different.
          const distinct=asset&&normalize(asset)!==normalize(plate);
          return distinct?[plate,asset,`${plate} ${asset}`]:[plate];
        }),
        ...carried.map(alias=>alias.value),
      ];
      for(const value of candidates){
        const key=normalize(value);
        if(!key||taken.has(key)||key===normalize(survivor.plateNumber))continue;
        taken.add(key);
        await tx.vehicleAlias.create({data:{vehicleId:survivorId,value,normalized:key}});
      }

      const transactions=await tx.fuelTransaction.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});
      const odometer=await tx.odometerLog.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});
      const assignments=await tx.vehicleAssignment.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});
      const policies=await tx.insurancePolicy.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});

      // Aliases still pointing at the duplicates would cascade away on delete; they were
      // copied above, so clearing them first keeps the delete clean.
      await tx.vehicleAlias.deleteMany({where:{vehicleId:{in:ids}}});
      await tx.vehicle.deleteMany({where:{id:{in:ids},organizationId:session.organizationId}});

      await tx.auditLog.create({data:{
        userId:session.userId,action:"MERGE",entityType:"Vehicle",entityId:survivorId,
        beforeValue:JSON.parse(JSON.stringify({removed:duplicates,movedTransactions})),
        afterValue:{keptId:survivorId,keptPlate:survivor.plateNumber,
          transactions:transactions.count,odometerLogs:odometer.count,
          assignments:assignments.count,policies:policies.count,aliasesKept:[...taken]},
      }});
      return {transactions:transactions.count,odometer:odometer.count,assignments:assignments.count,policies:policies.count,removed:duplicates.length};
    });
    for(const path of ["/vehicles","/transactions","/dashboard","/insurance","/reports"])revalidatePath(path);
    return{ok:true,error:"",moved};
  }catch{
    return{ok:false,error:"The merge could not be completed, so nothing was changed. Reload and try again."};
  }
}
