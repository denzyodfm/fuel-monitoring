import {normalize,vehicleLabel} from "./format";

export type FuelKind="diesel"|"gasoline"|"other"|"unspecified";
export const FUEL_TYPES=["Diesel","Gasoline"] as const;

// Fuel type is free text (typed in under "Others", or set on the vehicle), so common
// spellings ("DSL", "Unleaded", "Premium") still land in the right column of the report.
export const fuelKind=(fuelType?:string|null):FuelKind=>{
  const value=normalize(fuelType??"");
  if(/DIESEL|DSL/.test(value))return "diesel";
  if(/GASOLINE|PETROL|UNLEADED|PREMIUM|REGULAR/.test(value))return "gasoline";
  return value?"other":"unspecified";
};

export type ConsumptionSource={liters:unknown;amount:unknown;fuelType:string|null;companyOriginal:string|null;vehicleOriginal:string|null;company:{code:string}|null;vehicle:{id:string;plateNumber:string;assetName:string|null;fuelType:string|null}|null};
export type ConsumptionRow={vehicle:string;diesel:number;gasoline:number;other:number;unspecified:number;amount:number};
export type ConsumptionGroup={company:string;rows:ConsumptionRow[];amount:number};

// One row per vehicle under its charging company, as on the printed monthly report.
// Companies and the vehicles inside them are ordered by amount, largest first.
export function buildConsumption(transactions:ConsumptionSource[]){
  const groups=new Map<string,Map<string,ConsumptionRow>>();
  for(const item of transactions){
    const company=item.company?.code??item.companyOriginal??"Unmapped";
    const key=item.vehicle?.id??`original:${item.vehicleOriginal??""}`;
    const vehicles=groups.get(company)??new Map<string,ConsumptionRow>();groups.set(company,vehicles);
    const row=vehicles.get(key)??{vehicle:item.vehicle?vehicleLabel(item.vehicle.plateNumber,item.vehicle.assetName):item.vehicleOriginal||"No vehicle",diesel:0,gasoline:0,other:0,unspecified:0,amount:0};
    // What was recorded on the transaction wins; the vehicle's usual fuel covers older records.
    row[fuelKind(item.fuelType||item.vehicle?.fuelType)]+=Number(item.liters);row.amount+=Number(item.amount);
    vehicles.set(key,row);
  }
  const result:ConsumptionGroup[]=[...groups].map(([company,vehicles])=>{
    const rows=[...vehicles.values()].sort((a,b)=>b.amount-a.amount);
    return {company,rows,amount:rows.reduce((sum,row)=>sum+row.amount,0)};
  }).sort((a,b)=>b.amount-a.amount);
  const all=result.flatMap(group=>group.rows);
  const total={diesel:all.reduce((s,r)=>s+r.diesel,0),gasoline:all.reduce((s,r)=>s+r.gasoline,0),other:all.reduce((s,r)=>s+r.other,0),unspecified:all.reduce((s,r)=>s+r.unspecified,0),amount:all.reduce((s,r)=>s+r.amount,0)};
  return {groups:result,total};
}

const monthIndex=(month:string)=>{const [year,index]=month.split("-").map(Number);return year*12+index-1};
const monthKey=(index:number)=>`${Math.floor(index/12)}-${String(index%12+1).padStart(2,"0")}`;
export const shiftMonth=(month:string,delta:number)=>monthKey(monthIndex(month)+delta);
// Every month from `from` to `to` inclusive, so a month with no fuel still shows as a zero bar.
export const monthsBetween=(from:string,to:string)=>{
  const [start,end]=[monthIndex(from),monthIndex(to)].sort((a,b)=>a-b);
  return Array.from({length:end-start+1},(_,offset)=>monthKey(start+offset));
};
// "2026-04" → "Apr-26", the axis label used on the printed chart.
export const shortMonth=(month:string)=>{
  const [year,index]=month.split("-").map(Number);
  return `${new Date(year,index-1,1).toLocaleDateString("en-US",{month:"short"})}-${String(year).slice(2)}`;
};
