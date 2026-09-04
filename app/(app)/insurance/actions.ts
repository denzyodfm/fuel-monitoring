"use server";
import type {GeneralStatus} from "@prisma/client";
import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {revalidatePath} from "next/cache";

const value=(data:FormData,key:string)=>String(data.get(key)??"").trim();
const optional=(data:FormData,key:string)=>value(data,key)||null;
const statuses:GeneralStatus[]=["ACTIVE","PENDING","EXPIRED","CANCELLED"];

export async function saveInsurancePolicy(id:string|null,data:FormData){
  const session=await requireSession(["ADMINISTRATOR","STAFF"]);
  const vehicleId=value(data,"vehicleId"),insurer=value(data,"insurer");
  const start=value(data,"policyStart"),end=value(data,"policyEnd"),premium=value(data,"premium");
  if(!vehicleId)return{ok:false,error:"Select the vehicle this policy covers"};
  if(!insurer)return{ok:false,error:"Insurer is required"};
  if(!start||!end)return{ok:false,error:"Both the start and end dates are required"};
  const policyStart=new Date(`${start}T00:00:00`),policyEnd=new Date(`${end}T00:00:00`);
  if(Number.isNaN(policyStart.getTime())||Number.isNaN(policyEnd.getTime()))return{ok:false,error:"Enter valid start and end dates"};
  if(policyEnd<=policyStart)return{ok:false,error:"The end date must fall after the start date"};
  if(premium&&(Number.isNaN(Number(premium))||Number(premium)<0))return{ok:false,error:"Premium must be a positive amount"};
  const status=value(data,"status") as GeneralStatus;
  // Policies carry no organizationId of their own; they inherit it from the vehicle,
  // so confirm the vehicle belongs to this organization before writing.
  const vehicle=await db.vehicle.findFirst({where:{id:vehicleId,organizationId:session.organizationId}});
  if(!vehicle)return{ok:false,error:"That vehicle is not part of your organization"};
  const payload={
    vehicleId,insurer,
    policyNumber:optional(data,"policyNumber"),
    policyStart,policyEnd,
    premium:premium?premium:null,
    registeredOwner:optional(data,"registeredOwner"),
    assignedDriver:optional(data,"assignedDriver"),
    status:statuses.includes(status)?status:"ACTIVE",
    remarks:optional(data,"remarks"),
  };
  try{
    await db.$transaction(async tx=>{
      const before=id?await tx.insurancePolicy.findFirst({where:{id,vehicle:{organizationId:session.organizationId}}}):null;
      if(id&&!before)throw new Error("not found");
      const saved=id
        ?await tx.insurancePolicy.update({where:{id},data:payload})
        :await tx.insurancePolicy.create({data:payload});
      await tx.auditLog.create({data:{userId:session.userId,action:id?"UPDATE":"CREATE",entityType:"InsurancePolicy",entityId:saved.id,
        beforeValue:before?JSON.parse(JSON.stringify(before)):undefined,afterValue:JSON.parse(JSON.stringify(saved))}});
    });
  }catch{return{ok:false,error:"The policy could not be saved. Check the vehicle and dates, then try again."}}
  revalidatePath("/insurance");
  revalidatePath("/dashboard");
  return{ok:true,error:""};
}

export async function deleteInsurancePolicy(id:string,confirmation:string){
  const session=await requireSession(["ADMINISTRATOR"]);
  if(confirmation!=="DELETE")return{ok:false,error:"Type DELETE exactly to confirm"};
  try{
    await db.$transaction(async tx=>{
      const before=await tx.insurancePolicy.findFirst({where:{id,vehicle:{organizationId:session.organizationId}}});
      if(!before)throw new Error("not found");
      await tx.insurancePolicy.delete({where:{id}});
      await tx.auditLog.create({data:{userId:session.userId,action:"DELETE",entityType:"InsurancePolicy",entityId:id,beforeValue:JSON.parse(JSON.stringify(before))}});
    });
  }catch{return{ok:false,error:"This policy has attachments and cannot be deleted. Mark it cancelled instead."}}
  revalidatePath("/insurance");
  revalidatePath("/dashboard");
  return{ok:true,error:""};
}
