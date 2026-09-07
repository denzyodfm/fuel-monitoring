import type {Prisma} from "@prisma/client";
import {normalize} from "@/lib/format";

export type MergeResult={transactions:number;odometer:number;assignments:number;policies:number;removed:number;keptPlate:string;aliases:string[]};

// The whole merge, as one function, so the Settings button and any maintenance script run
// identical code. Caller supplies the transaction client and has already authorized.
export async function mergeVehiclesInTransaction(
  tx:Prisma.TransactionClient,
  {organizationId,userId,survivorId,duplicateIds}:{organizationId:string;userId:string|null;survivorId:string;duplicateIds:string[]},
):Promise<MergeResult>{
  const ids=[...new Set(duplicateIds)].filter(id=>id&&id!==survivorId);
  const vehicles=await tx.vehicle.findMany({where:{id:{in:[survivorId,...ids]},organizationId}});
  if(vehicles.length!==ids.length+1)throw new Error("One of those vehicles is no longer available");
  const survivor=vehicles.find(vehicle=>vehicle.id===survivorId)!;
  const duplicates=vehicles.filter(vehicle=>vehicle.id!==survivorId);

  // Recorded in the audit entry so the move can be traced, and undone by hand if needed.
  const movedTransactions=await tx.fuelTransaction.findMany({where:{vehicleId:{in:ids}},select:{id:true,vehicleId:true}});
  const taken=new Set((await tx.vehicleAlias.findMany({where:{vehicleId:survivorId}})).map(alias=>alias.normalized));

  // Excel import matches a vehicle on its plate, on "plate + asset name", and on its aliases.
  // Keep every spelling the duplicates answered to, or the next import would fail to match
  // and quietly recreate them.
  const carried=await tx.vehicleAlias.findMany({where:{vehicleId:{in:ids}}});
  const candidates=[
    ...duplicates.flatMap(vehicle=>{
      const plate=vehicle.plateNumber.trim(),asset=(vehicle.assetName??"").trim();
      // Many records repeat the plate in the asset name, so the combined form is only worth
      // keeping when the asset name actually says something different.
      const distinct=asset&&normalize(asset)!==normalize(plate);
      return distinct?[plate,asset,`${plate} ${asset}`]:[plate];
    }),
    ...carried.map(alias=>alias.value),
  ];
  const aliases:string[]=[];
  for(const value of candidates){
    const key=normalize(value);
    if(!key||taken.has(key)||key===normalize(survivor.plateNumber))continue;
    taken.add(key);
    await tx.vehicleAlias.create({data:{vehicleId:survivorId,value,normalized:key}});
    aliases.push(value);
  }

  const transactions=await tx.fuelTransaction.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});
  const odometer=await tx.odometerLog.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});
  const assignments=await tx.vehicleAssignment.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});
  const policies=await tx.insurancePolicy.updateMany({where:{vehicleId:{in:ids}},data:{vehicleId:survivorId}});

  // Aliases still pointing at the duplicates would cascade away on delete; they were copied
  // above, so clearing them first keeps the delete clean.
  await tx.vehicleAlias.deleteMany({where:{vehicleId:{in:ids}}});
  await tx.vehicle.deleteMany({where:{id:{in:ids},organizationId}});

  await tx.auditLog.create({data:{
    userId,action:"MERGE",entityType:"Vehicle",entityId:survivorId,
    beforeValue:JSON.parse(JSON.stringify({removed:duplicates,movedTransactions})),
    afterValue:{keptId:survivorId,keptPlate:survivor.plateNumber,transactions:transactions.count,
      odometerLogs:odometer.count,assignments:assignments.count,policies:policies.count,aliasesAdded:aliases},
  }});

  return {transactions:transactions.count,odometer:odometer.count,assignments:assignments.count,
    policies:policies.count,removed:duplicates.length,keptPlate:survivor.plateNumber,aliases};
}
