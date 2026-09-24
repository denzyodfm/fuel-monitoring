import type {Prisma,TransactionStatus} from "@prisma/client";
import Link from "next/link";
import {ArrowDown,ArrowUp,ArrowUpDown} from "lucide-react";
import {db} from "@/lib/db";
import {requireSession} from "@/lib/auth";
import {php,liters,vehicleLabel} from "@/lib/format";
import {PageHeading} from "@/components/page-heading";
import {TransactionFilters} from "@/components/transaction-filters";
import {EditTransactionModal} from "@/components/edit-transaction-modal";
import {AddTransactionModal} from "@/components/add-transaction-modal";
import {DeleteTransactionButton} from "@/components/delete-transaction-button";
import {TransactionSummaryModal} from "@/components/transaction-summary-modal";
import {MonthLockModal,type MonthRow} from "@/components/month-lock-modal";
import {getMonthLocks,monthLabel} from "@/lib/month-locks";

type Q={q?:string;status?:string;company?:string;vehicle?:string;operator?:string;from?:string;to?:string;period?:string;page?:string;sort?:string;dir?:string};

const sortColumns={
  date:{label:"Date",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({transactionDate:dir})},
  po:{label:"P.O. Number",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({poNumber:dir})},
  company:{label:"Company",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({company:{code:dir}})},
  vehicle:{label:"Vehicle",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({vehicle:{plateNumber:dir}})},
  operator:{label:"Driver / Operator",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({operator:{fullName:dir}})},
  price:{label:"Price / L",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({unitPrice:dir})},
  liters:{label:"Liters",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({liters:dir})},
  amount:{label:"Amount",order:(dir:Prisma.SortOrder):Prisma.FuelTransactionOrderByWithRelationInput=>({amount:dir})},
};
type SortKey=keyof typeof sortColumns;

const periodLabels:Record<string,string>={"":"All dates","this-month":"This month","last-month":"Last month","this-year":"This year","last-year":"Last year","custom":"Custom date"};

export default async function Page({searchParams}:{searchParams:Promise<Q>}){
  const session=await requireSession(),query=await searchParams,page=Math.max(1,Number(query.page)||1),and:Prisma.FuelTransactionWhereInput[]=[];
  const canManage=session.role==="ADMINISTRATOR"||session.role==="STAFF";
  // Newest first until a column header is clicked; clicking the active column flips direction.
  const sort:SortKey=query.sort&&query.sort in sortColumns?query.sort as SortKey:"date";
  const dir:Prisma.SortOrder=query.dir==="asc"||query.dir==="desc"?query.dir:sort==="date"?"desc":"asc";
  const where:Prisma.FuelTransactionWhereInput={organizationId:session.organizationId,deletedAt:null,AND:and};
  if(query.status)where.status=query.status as TransactionStatus;
  if(query.company)and.push({companyId:query.company});
  if(query.vehicle)and.push({vehicleId:query.vehicle});
  if(query.operator)and.push({operatorId:query.operator});
  if(query.from||query.to)where.transactionDate={...(query.from?{gte:new Date(`${query.from}T00:00:00`)}:{}),...(query.to?{lte:new Date(`${query.to}T23:59:59`)}:{})};
  if(query.q)and.push({OR:[{poNumber:{contains:query.q}},{invoiceNumber:{contains:query.q}},{vehicleOriginal:{contains:query.q}},{operatorOriginal:{contains:query.q}},{vehicle:{is:{OR:[{plateNumber:{contains:query.q}},{assetName:{contains:query.q}}]} }},{operator:{is:{fullName:{contains:query.q}}}}]});
  const [items,total,vehicles,operators,companies,purposes,byCompany,byVehicle,byOperator,summaryTransactions]=await Promise.all([
    db.fuelTransaction.findMany({where,include:{company:true,vehicle:true,operator:true},orderBy:[sortColumns[sort].order(dir),{transactionDate:"desc"},{id:"desc"}],skip:(page-1)*25,take:25}),
    db.fuelTransaction.count({where}),db.vehicle.findMany({where:{organizationId:session.organizationId},orderBy:{plateNumber:"asc"}}),db.operator.findMany({where:{organizationId:session.organizationId},orderBy:{fullName:"asc"}}),db.company.findMany({where:{organizationId:session.organizationId,active:true},orderBy:{code:"asc"}}),db.purpose.findMany({where:{organizationId:session.organizationId,active:true},orderBy:{name:"asc"}}),
    db.fuelTransaction.groupBy({by:["companyId"],where,_sum:{liters:true,amount:true},orderBy:{_sum:{amount:"desc"}}}),db.fuelTransaction.groupBy({by:["vehicleId"],where,_sum:{liters:true,amount:true},orderBy:{_sum:{amount:"desc"}}}),db.fuelTransaction.groupBy({by:["operatorId"],where,_sum:{liters:true,amount:true},orderBy:{_sum:{amount:"desc"}}}),db.fuelTransaction.findMany({where,select:{companyId:true,vehicleId:true,operatorId:true,poNumber:true}})
  ]);
  const [monthGroups,locks]=await Promise.all([
    db.$queryRaw<{month:string;count:bigint}[]>`SELECT DATE_FORMAT(transactionDate,'%Y-%m') month,COUNT(*) count FROM FuelTransaction WHERE organizationId=${session.organizationId} AND deletedAt IS NULL GROUP BY month ORDER BY month DESC`,
    getMonthLocks(session.organizationId),
  ]);
  // A month with no transactions can still be closed ahead of time, so locked months are
  // merged in even when nothing has been entered against them yet.
  const counts=new Map(monthGroups.map(row=>[row.month,Number(row.count)]));
  for(const lock of locks)if(!counts.has(lock.month))counts.set(lock.month,0);
  const monthRows:MonthRow[]=[...counts.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([month,transactions])=>{
    const lock=locks.find(item=>item.month===month);
    return {month,label:monthLabel(month),transactions,locked:Boolean(lock),
      lockedByName:lock?.lockedByName??"",lockedAt:lock?.lockedAt??""};
  });
  const vehicleOptions=vehicles.map(item=>({value:item.id,label:vehicleLabel(item.plateNumber,item.assetName)})),operatorOptions=operators.map(item=>({value:item.id,label:item.fullName})),companyOptions=companies.map(item=>({value:item.id,label:`${item.code} - ${item.name}`})),purposeOptions=purposes.map(item=>({value:item.id,label:item.name}));
  const vehicleNames=new Map(vehicles.map(item=>[item.id,item.plateNumber])),operatorNames=new Map(operators.map(item=>[item.id,item.fullName])),companyNames=new Map(companies.map(item=>[item.id,item.code]));
  const poNumbersFor=(field:"companyId"|"vehicleId"|"operatorId",id:string|null)=>[...new Set(summaryTransactions.filter(transaction=>transaction[field]===id).map(transaction=>transaction.poNumber).filter((po):po is string=>Boolean(po)))].sort();
  const sections=[
    {title:"Summary by company",label:"Company",rows:byCompany.map(item=>({label:item.companyId?companyNames.get(item.companyId)??"Unknown company":"Unassigned",poNumbers:poNumbersFor("companyId",item.companyId),liters:Number(item._sum.liters??0),amount:Number(item._sum.amount??0)}))},
    {title:"Summary by vehicle",label:"Vehicle",rows:byVehicle.map(item=>({label:item.vehicleId?vehicleNames.get(item.vehicleId)??"Unknown vehicle":"Unassigned",poNumbers:poNumbersFor("vehicleId",item.vehicleId),liters:Number(item._sum.liters??0),amount:Number(item._sum.amount??0)}))},
    {title:"Summary by driver / operator",label:"Driver / Operator",rows:byOperator.map(item=>({label:item.operatorId?operatorNames.get(item.operatorId)??"Unknown operator":"Unassigned",poNumbers:poNumbersFor("operatorId",item.operatorId),liters:Number(item._sum.liters??0),amount:Number(item._sum.amount??0)}))}
  ];
  const filters=[{label:"Search",value:query.q||"All records"},{label:"Company",value:companyOptions.find(option=>option.value===query.company)?.label||"All companies"},{label:"Vehicle",value:vehicleOptions.find(option=>option.value===query.vehicle)?.label||"All vehicles"},{label:"Driver / Operator",value:operatorOptions.find(option=>option.value===query.operator)?.label||"All operators"},{label:"Date range",value:periodLabels[query.period??""]??"Custom date"},{label:"From",value:query.from||"Any date"},{label:"To",value:query.to||"Any date"},{label:"Status",value:query.status||"All statuses"}];
  const totalLiters=byCompany.reduce((sum,item)=>sum+Number(item._sum.liters??0),0),totalAmount=byCompany.reduce((sum,item)=>sum+Number(item._sum.amount??0),0);
  const params=new URLSearchParams(Object.entries(query).filter(([key,value])=>key!=="page"&&value).map(([key,value])=>[key,String(value)]));
  const sortHeader=(key:SortKey)=>{
    const active=sort===key,next=new URLSearchParams(params);
    next.set("sort",key);next.set("dir",active?(dir==="asc"?"desc":"asc"):"asc");
    const Icon=active?(dir==="asc"?ArrowUp:ArrowDown):ArrowUpDown;
    return <th key={key} aria-sort={active?(dir==="asc"?"ascending":"descending"):"none"}><Link href={`?${next}`} className={`sort-header${active?" active":""}`}>{sortColumns[key].label}<Icon size={12} className="no-print" aria-hidden/></Link></th>;
  };
  return <><div className="print-header"><h1>Fuel Transaction Report</h1></div><PageHeading title="Fuel transactions" description={`${total} normalized operational records`} action={<div className="flex gap-2"><MonthLockModal months={monthRows} canLock={canManage} canUnlock={session.role==="ADMINISTRATOR"}/><TransactionSummaryModal sections={sections} filters={filters}/>{canManage&&<AddTransactionModal companies={companyOptions} vehicles={vehicleOptions} operators={operatorOptions} purposes={purposeOptions}/>}</div>}/><div className="no-print"><TransactionFilters initial={{q:query.q??"",status:query.status??"",company:query.company??"",vehicle:query.vehicle??"",operator:query.operator??"",from:query.from??"",to:query.to??"",period:query.period??"",sort:query.sort??"",dir:query.dir??""}} companies={companyOptions} vehicles={vehicleOptions} operators={operatorOptions}/></div><div className="card desktop-table print-table"><table className="table"><thead><tr>{(Object.keys(sortColumns) as SortKey[]).map(sortHeader)}{canManage&&<th className="no-print">Action</th>}</tr></thead><tbody>{items.map(transaction=><tr key={transaction.id}><td>{transaction.transactionDate.toLocaleDateString("en-PH")}</td><td>{transaction.poNumber||"No P.O."}</td><td>{transaction.company?.code??transaction.companyOriginal}</td><td>{transaction.vehicle?.plateNumber??transaction.vehicleOriginal??"-"}</td><td>{transaction.operator?.fullName??transaction.operatorOriginal??"-"}</td><td>{php.format(Number(transaction.unitPrice))}</td><td>{liters(transaction.liters.toString())}</td><td>{php.format(Number(transaction.amount))}</td>{canManage&&<td className="no-print"><div className="flex gap-1"><EditTransactionModal transaction={{id:transaction.id,transactionDate:transaction.transactionDate.toISOString().slice(0,10),invoiceNumber:transaction.invoiceNumber??"",poNumber:transaction.poNumber??"",companyId:transaction.companyId??"",vehicleId:transaction.vehicleId??"",operatorId:transaction.operatorId??"",purposeId:transaction.purposeId??"",unitPrice:transaction.unitPrice.toString(),liters:transaction.liters.toString(),requestedAmount:transaction.requestedAmount?.toString()??"",odometer:transaction.odometer?.toString()??"",notes:transaction.notes??""}} companies={companyOptions} vehicles={vehicleOptions} operators={operatorOptions} purposes={purposeOptions}/><DeleteTransactionButton id={transaction.id}/></div></td>}</tr>)}</tbody><tfoot><tr className="transaction-total-row"><th colSpan={6} className="transaction-total-label">Filtered totals ({total} records)</th><th>{liters(totalLiters)}</th><th>{php.format(totalAmount)}</th>{canManage&&<th className="no-print"/>}</tr></tfoot></table>{!items.length&&<p className="p-8 text-center text-slate-500">No matching transactions.</p>}</div><div className="mt-4 flex gap-2 no-print"><Link className="btn secondary" href={`?${params}&page=${Math.max(1,page-1)}`}>Previous</Link><span className="p-2">Page {page} of {Math.max(1,Math.ceil(total/25))}</span><Link className="btn secondary" href={`?${params}&page=${Math.min(Math.max(1,Math.ceil(total/25)),page+1)}`}>Next</Link></div></>;
}
