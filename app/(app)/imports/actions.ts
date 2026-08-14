"use server";

import type {Prisma,Role} from "@prisma/client";
import {readFile} from "node:fs/promises";
import {basename,resolve} from "node:path";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {requireSession,type Session} from "@/lib/auth";
import {db} from "@/lib/db";
import {parseWorkbook} from "@/lib/excel";
import {normalize} from "@/lib/format";

const json=(value:unknown)=>value as Prisma.InputJsonValue;

async function processWorkbook(buffer:Buffer,filename:string,dryRun:boolean,session:Session){
  const parsed=parseWorkbook(buffer);
  const existing=await db.importBatch.findUnique({where:{organizationId_checksum:{organizationId:session.organizationId,checksum:parsed.checksum}}});
  if(existing?.status!=="DRY_RUN"&&existing)redirect(`/imports?error=${encodeURIComponent("This exact workbook was already imported")}`);
  if(existing)await db.importBatch.delete({where:{id:existing.id}});

  const [companies,operators,vehicles,purposes]=await Promise.all([
    db.company.findMany({where:{organizationId:session.organizationId}}),
    db.operator.findMany({where:{organizationId:session.organizationId},include:{aliases:true}}),
    db.vehicle.findMany({where:{organizationId:session.organizationId},include:{aliases:true}}),
    db.purpose.findMany({where:{organizationId:session.organizationId}}),
  ]);
  const companyMap=new Map(companies.map(item=>[normalize(item.code),item.id]));
  const operatorMap=new Map(operators.flatMap(item=>[[normalize(item.fullName),item.id] as const,...item.aliases.map(alias=>[alias.normalized,item.id] as const)]));
  const vehicleMap=new Map(vehicles.flatMap(item=>[[normalize(item.plateNumber),item.id] as const,[normalize(`${item.plateNumber} ${item.assetName??""}`),item.id] as const,...item.aliases.map(alias=>[alias.normalized,item.id] as const)]));
  const purposeMap=new Map(purposes.map(item=>[normalize(item.name),item.id]));
  const ambiguousCount=parsed.rows.filter(row=>!companyMap.has(normalize(row.company))).length;

  await db.$transaction(async transaction=>{
    const batch=await transaction.importBatch.create({data:{organizationId:session.organizationId,uploadedById:session.userId,filename,checksum:parsed.checksum,status:dryRun?"DRY_RUN":"IMPORTING",dryRun,totalRows:parsed.rows.length+parsed.rejected.length}});
    let importedCount=0;
    for(const row of parsed.rows){
      const companyId=companyMap.get(normalize(row.company));
      const operatorId=operatorMap.get(normalize(row.operator));
      const vehicleId=vehicleMap.get(normalize(row.vehicle));
      const purposeId=purposeMap.get(normalize(row.purpose));
      const ambiguous=!companyId;
      await transaction.importRow.create({data:{batchId:batch.id,sheetName:row.sheet,rowNumber:row.row,classification:"TRANSACTION",status:ambiguous?"AMBIGUOUS":dryRun?"VALID":"IMPORTED",fingerprint:row.fingerprint,originalValues:json(row.original),normalizedValues:json({companyId,operatorId,vehicleId,purposeId}),reason:ambiguous?`Unknown company: ${row.company}`:null}});
      if(!dryRun&&companyId){
        await transaction.fuelTransaction.upsert({where:{organizationId_fingerprint:{organizationId:session.organizationId,fingerprint:row.fingerprint}},update:{},create:{organizationId:session.organizationId,transactionDate:row.date,invoiceNumber:row.invoice,poNumber:row.po,operatorId,companyId,vehicleId,purposeId,operatorOriginal:row.operator,companyOriginal:row.company,vehicleOriginal:row.vehicle,purposeOriginal:row.purpose,unitPrice:row.unitPrice,liters:row.liters,amount:row.amount,requestedAmount:row.requestedAmount,source:"EXCEL_IMPORT",sourceWorkbook:filename,sourceSheet:row.sheet,sourceRow:row.row,sourceValues:json(row.original),fingerprint:row.fingerprint,importBatchId:batch.id,createdById:session.userId}});
        importedCount++;
      }
    }
    for(const rejected of parsed.rejected)await transaction.importRow.create({data:{batchId:batch.id,sheetName:rejected.sheet,rowNumber:rejected.row,classification:"REJECTED",status:"REJECTED",originalValues:json(rejected.original),reason:rejected.reason}});
    await transaction.importBatch.update({where:{id:batch.id},data:{status:dryRun?"DRY_RUN":"COMPLETED",validRows:parsed.rows.length-ambiguousCount,importedRows:importedCount,rejectedRows:parsed.rejected.length+ambiguousCount,completedAt:new Date(),reconciliation:json({detailSheets:parsed.classified.filter(sheet=>sheet.type==="TRANSACTION_DETAIL").map(sheet=>sheet.name),monthlySheetsExcluded:parsed.classified.filter(sheet=>sheet.type==="MONTHLY_RECONCILIATION").map(sheet=>sheet.name)})}});
    await transaction.auditLog.create({data:{userId:session.userId,action:dryRun?"IMPORT_DRY_RUN":"IMPORT",entityType:"ImportBatch",entityId:batch.id,afterValue:json({filename,rows:parsed.rows.length})}});
  },{timeout:120000});
  revalidatePath("/imports");revalidatePath("/dashboard");revalidatePath("/transactions");
}

export async function importWorkbook(formData:FormData){
  const session=await requireSession(["ADMINISTRATOR"] as Role[]);
  const file=formData.get("workbook");
  if(!(file instanceof File)||!file.size)redirect("/imports?error=Choose+a+workbook");
  await processWorkbook(Buffer.from(await file.arrayBuffer()),file.name,formData.get("dryRun")==="on",session);
}

export async function importSuppliedWorkbook(){
  const session=await requireSession(["ADMINISTRATOR"] as Role[]);
  const workbookPath=resolve(process.env.IMPORT_WORKBOOK_PATH??"./data/Fuel Monitoring 2026 FROM BERN 8.12.26.xlsx");
  await processWorkbook(await readFile(workbookPath),basename(workbookPath),false,session);
}
